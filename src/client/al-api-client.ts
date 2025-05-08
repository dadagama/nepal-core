/**
 *  Alert Logic axios extension - an API Client with automatic service discovery, local caching, and retry functionality baked in.
 *
 *  An instance of the client can be constructed manually, but in general you should just use the global instance `AlDefaultClient`.
 *
 *  Most use cases can be handled by using one of the client's convenience methods, which includes support for local caching and retries:
 *
 *  `.rawGet<Type>( config )` - executes a GET request and resolves with the full response descriptor from axios
 *  `.get<Type>( config )` - executes a GET request and resolves with the response payload from axios, as Type.
 *  `.rawPost<Type>( config )` - executes a POST request and resolves with the full response descriptor from axios
 *  `.post<Type>( config )` - executes a POST request and resolves with the response payload from axios, as Type.
 *  `.rawPut<Type>( config )` - executes a PUT request and resolves with the full response descriptor from axios
 *  `.put<Type>( config )` - executes a PUT request and resolves with the response payload from axios, as Type.
 *  `.rawDelete<Type>( config )` - executes a DELETE request and resolves with the full response descriptor from axios
 *  `.delete<Type>( config )` - executes a DELETE request and resolves with the response payload from axios, as Type.
 *
 *  Alternatively, a request can be normalized and dispatched without caching or retry logic using this method:
 *
 *  ```
 *  let normalizedRequest = AlDefaultClient.normalizeRequest( config );
 *  let response = await AlDefaultClient.doRequest<Type>( method, normalizedRequest );
 *  ```
 */
import axios, {
    AxiosInstance,
    AxiosRequestConfig,
    AxiosResponse,
    Method,
} from 'axios';
import * as base64JS from 'base64-js';
import { AlDataValidationError, AlGatewayTimeoutError } from '../common/errors';
import { AlLocationContext, AlLocationDescriptor } from '../abstract';
import { AlLocation, AlLocatorService } from "../navigation";
import {
    AlCabinet,
    AlGlobalizer,
    AlMutex,
    AlStopwatch,
    AlTriggerStream,
    deepMerge,
    getJsonPath,
    setJsonPath
} from "../common/utility";
import {
    APIExecutionLogItem,
    APIExecutionLogSummary,
    APIRequestParams,
    AlInterceptionRule,
    AlInterceptionRules,
} from './types';
import { AlClientBeforeRequestEvent, AlClientAPIErrorEvent } from './events';
import { AIMSSessionDescriptor } from '../aims-client/types';
import { AlRuntimeConfiguration } from '../configuration';
import { commonTypeSchematics } from './common.schematics';

/**
 *  A dictionary of resolved endpoints, keyed by environment, account, service, and residency.
 *  Residency may be US, EMEA, or default (which corresponds with the legacy "infer from primary account's default location" logic.
 */
type AlEndpointsDictionary = {
  [environment:string]: {
    [accountId:string]: {
      [serviceId:string]: {
        [residency:string]: string;
      };
    }
  }
};

export class AlApiClient
{
  /**
   * The following list of services are the ones whose endpoints will be resolved by default.  Added globally/commonly used services here for optimized API performance.
   */
  protected static defaultServiceList = [ "aims", "subscriptions", "search", "sources", "assets_query", "assets_write", "dashboards", "suggestions", "connectors", "herald" ];
  /**
   * The following list of services are the ones whose endpoints will need to be determined for the current context active residency location.
   */
  protected static resolveByResidencyServiceList = [ "iris", "kalm", "ticketmaster", "tacoma", "responder", "responder-async", "cargo" ];

  protected static defaultServiceParams: APIRequestParams = {
    service_stack:                  AlLocation.InsightAPI,  //  May also be AlLocation.GlobalAPI, AlLocation.EndpointsAPI, or ALLocation.LegacyUI
    version:                        'v1',                   //  Version of the service
    ttl:                            false                   //  Default to no caching
  };

  protected static defaultResidency = 'default';

  public events:AlTriggerStream     =   new AlTriggerStream();
  public verbose:boolean            =   false;
  public collectRequestLog:boolean  =   false;
  public mockMode:boolean           =   false;              //  If true, requests will be normalized but not actually dispatched.
  public mockRequests:any[]         =   [];
  public defaultAccountId:string    =   null;        //  If specified, uses *this* account ID to resolve endpoints if no other account ID is explicitly specified

  private storage                   =   AlCabinet.local( 'apiclient.cache' );
  private instance:AxiosInstance = null;
  private lastError:AxiosResponse = null;
  private endpointsGuard            =   new AlMutex();
  private endpointCache:AlEndpointsDictionary = {};

  /* List of stacks (service_stack property in APIRequestParams) that should have endpoints resolution enabled by default */
  private endpointsStackWhitelist = [
      AlLocation.InsightAPI,
      AlLocation.MDRAPI
  ];

  /* Default request parameters */
  private globalServiceParams: APIRequestParams;

  /* Dictionary of in-flight GET requests */
  private transientReadCache:{[resourceKey:string]:Promise<any>} = {};

  /* Internal execution log */
  private executionRequestLog:APIExecutionLogItem[] = [];

  private interceptionRules?:AlInterceptionRules;
  private beforeRequest?:{():Promise<any>};

  constructor() {
      // temp to debug ie11
      this.globalServiceParams = this.merge( {}, AlApiClient.defaultServiceParams );
  }

  /**
   * Resets internal state back to its factory defaults.
   */
  public reset():AlApiClient {
    this.endpointCache = {};
    this.instance = null;
    this.executionRequestLog = [];
    this.storage.destroy();
    this.globalServiceParams = this.merge( {}, AlApiClient.defaultServiceParams );
    return this;
  }

  /**
   * Flushes the caches keys if they are present in the config request params.
   */
  public flushCacheKeysFromConfig(config: APIRequestParams) {
    try {
      if ( config.flushCacheKeys ) {
        config.flushCacheKeys.forEach((cacheKey) => {
          this.deleteCachedValue(cacheKey);
          caches.delete(cacheKey);
        });
      }
    } catch( e ) {
      console.log( `Cache deletion error: `, e );
    }
  }

  /**
   * Get the full url from a config api request.
   * Note: This method is intended to be used as a helper from outside,
   * we need to normalize here.
   */
  public async fromConfigToFullUrl(config: APIRequestParams) {
    let normalized = await this.normalizeRequest( config );
    if (config.method === 'GET') {
      let queryParams = this.normalizeQueryParams(config.params);
      return `${normalized.url}${queryParams}`;
    }
    return normalized.url;
  }

  /**
   * This allows the host to set global parameters that will be used for every request, either for Axios or the @al/client service layer.
   * Most notably, setting `noEndpointsResolution` to true will suppress endpoints resolution for all requests, and cause default endpoint values to be used.
   */
  public setGlobalParameters( parameters:APIRequestParams ):AlApiClient {
    this.globalServiceParams = this.merge( this.globalServiceParams, parameters );
    return this;
  }

  /**
   * GET - Return Cache, or Call for updated data
   */
  public async rawGet<T = any>(config: APIRequestParams): Promise<AxiosResponse<T>> {
    config.method = 'GET';
    let normalized = await this.normalizeRequest( config );
    let queryParams = this.normalizeQueryParams( config.params );
    let fullUrl = `${normalized.url}${queryParams}`;

    //  Check for data in cache
    let cacheTTL = 0;
    const cacheKey = normalized.cacheKey || fullUrl;
    if ( typeof( normalized.ttl ) === 'number' && normalized.ttl > 0 ) {
      cacheTTL = normalized.ttl;
    } else if ( typeof( normalized.ttl ) === 'boolean' && normalized.ttl ) {
      cacheTTL = 60000;
    }
    if ( cacheTTL && ! normalized.disableCache ) {
      let cachedValue = this.getCachedValue( fullUrl );
      if ( cachedValue ) {
        this.log(`APIClient::XHR GET ${fullUrl} (from cache)` );
        return {
          data: cachedValue,
          status: 200,
          statusText: "OK",
          headers: {},
          config: normalized
        };
      }
    }
    //  Check for existing in-flight requests for this resource
    if ( this.transientReadCache.hasOwnProperty( cacheKey ) ) {
      this.log(`APIClient::XHR GET Re-using inflight retrieval [${fullUrl}]` );
      const result = await this.transientReadCache[cacheKey];
      return result;
    }

    let start = Date.now();
    try {
      const request = this.axiosRequest( normalized );
      this.transientReadCache[cacheKey] = request;       //  store request instance to consolidate multiple requests for a single resource
      const response = await request;
      const completed = Date.now();
      const duration = completed - start;
      if ( cacheTTL && ! normalized.disableCache ) {
        this.setCachedValue( cacheKey, response.data, cacheTTL );
        this.log(`APIClient::XHR GET [${fullUrl}] in ${duration}ms (to cache, ${cacheTTL}ms)` );
      } else {
        this.log(`APIClient::XHR GET [${fullUrl} in ${duration}ms (nocache)` );
      }

      if (this.collectRequestLog || this.verbose) {
        let logItem:APIExecutionLogItem = {
          method: config.method,
          url: fullUrl,
          responseCode: response.status,
          responseContentLength: +response.headers['content-length'],
          durationMs: duration
        };
        this.log(`APIClient::XHR DETAILS ${JSON.stringify(logItem)}`);

        if (this.collectRequestLog) {
          this.executionRequestLog.push(logItem);
        }
      }

      return response;
    } catch( e ) {
      this.log(`APIClient::XHR GET [${fullUrl}] (FAILED, ${e["message"]})` );
      throw e;
    } finally {
      delete this.transientReadCache[cacheKey];
    }
  }

  public async get<T = any>(config: APIRequestParams): Promise<T> {
    let response = await this.rawGet<T>( config );
    return response.data;
  }

  /**
   * @deprecated
   * Alias for GET utility method
   */
  public async fetch<T = any>(config: APIRequestParams):Promise<T> {
    console.warn("Deprecation warning: do not use AlApiClient.fetch; use `get` instead." );
    return this.get<T>( config );
  }

  /**
   * POST - clears cache and posts for new/merged data
   */
  public async rawPost<T = any>(config: APIRequestParams): Promise<AxiosResponse<T>> {
    config.method = 'POST';
    const normalized = await this.normalizeRequest( config );
    if ( ! normalized.disableCache ) {
      this.deleteCachedValue( normalized.url );
    }
    const response = await this.doRequest<T>( config.method, normalized );
    return response;
  }

  public async post<T = any>(config:APIRequestParams): Promise<T> {
    let response = await this.rawPost<T>( config );
    return response.data;
  }

  /**
   * Form data submission
   */
  public async rawForm<T = any>(config: APIRequestParams) :Promise<AxiosResponse<T>>{
    config.method = 'POST';
    config.headers = {
        'Content-Type': 'multipart/form-data'
    };
    const normalized = await this.normalizeRequest( config );
    if ( ! normalized.disableCache ) {
      this.deleteCachedValue( normalized.url );
    }
    const response = await this.doRequest<T>( config.method, normalized );
    return response;
  }

  public async form<T = any>(config:APIRequestParams): Promise<T> {
    let response = await this.rawForm<T>( config );
    return response.data;
  }

  /**
   * PUT - replaces data
   */
  public async rawPut<T = any>(config: APIRequestParams) :Promise<AxiosResponse<T>>{
    config.method = 'PUT';
    const normalized = await this.normalizeRequest( config );
    if ( ! normalized.disableCache ) {
      this.deleteCachedValue( normalized.url );
    }
    const response = await this.doRequest<T>( config.method, normalized );
    return response;
  }

  public async put<T = any>(config:APIRequestParams): Promise<T> {
    let response = await this.rawPut<T>(config);
    return response.data;
  }

  /**
   * @deprecated
   * Alias for PUT utility method
   */
  public async set<T = any>( config:APIRequestParams ) :Promise<T>{
    console.warn("Deprecation warning: do not use AlApiClient.set; use `put` instead." );
    return this.put<T>( config );
  }

  /**
   * Delete data
   */
  public async rawDelete<T = any>(config: APIRequestParams) :Promise<AxiosResponse<T>>{
    config.method = 'DELETE';
    const normalized = await this.normalizeRequest( config );
    this.deleteCachedValue( normalized.url );
    const response = await this.doRequest<T>( config.method, normalized );
    return response;
  }

  public async delete<T = any>(config: APIRequestParams ): Promise<T> {
    let response = await this.rawDelete<T>( config );
    return response.data;
  }

  public async executeRequest<ResponseType>( options:APIRequestParams ):Promise<AxiosResponse<ResponseType>> {
    return this.axiosRequest<ResponseType>( options );
  }

  /**
   * Perform a request collecting all details related to the request, if
   * collectRequestLog is active.
   * @param method The method of the request. [POST PUT DELETE GET]
   * @param normalizedParams The normalized APIRequestParams object.
   */
  public async doRequest<T = any>(method:Method, normalizedParams:APIRequestParams):Promise<AxiosResponse<T>> {
    let response:AxiosResponse;
    let start:number = 0;
    let logItem:APIExecutionLogItem = {};

    if (this.collectRequestLog) {
      start = Date.now();
      logItem.method = method;
      logItem.url = normalizedParams.url;
    }

    this.flushCacheKeysFromConfig(normalizedParams);

    try {
      response = await this.axiosRequest<T>( normalizedParams );

      if (this.collectRequestLog) {
        const completed = Date.now();
        const duration = completed - start;

        logItem.responseCode = response.status;
        logItem.responseContentLength = +response.headers['content-length'];
        logItem.durationMs = duration;

        this.executionRequestLog.push(logItem);
      }

      this.log(`APIClient::XHR DETAILS ${JSON.stringify(logItem)}`);

    } catch( e ) {
      if (this.collectRequestLog) {
        const completed = Date.now();
        const duration = completed - start;
        logItem.responseCode = e.status;
        logItem.durationMs = duration;
        logItem.errorMessage = e["message"];
      }
      this.log(`APIClient::XHR FAILED ${JSON.stringify(logItem)}`);
      throw e;
    }

    return response;
  }

  /**
   * Returns a summary of requests based in the internal log array.
   */
  public getExecutionSummary():APIExecutionLogSummary {
    let summary = {
      numberOfRequests: 0,
      totalRequestTime: 0,
      totalBytes: 0
    };

    if (this.executionRequestLog) {
      summary.numberOfRequests = this.executionRequestLog.length;
      this.executionRequestLog.forEach(logItem => {
        summary.totalRequestTime += logItem.durationMs;
        summary.totalBytes += logItem.responseContentLength;
      });
    }

    return summary;
  }

  /**
   * Retrieve a reference to the last HTTP error response received.
   */
  public getLastError():AxiosResponse {
    return this.lastError;
  }

  /**
   * @deprecated
   *
   * Provides a concise way to manipulate the AlLocatorService without importing it directly...
   *
   * @param {array} locations An array of locator descriptors.
   * @param {string|boolean} actingUri The URI to use to calculate the current location and location context; defaults to window.location.origin.
   * @param {AlLocationContext} The effective location context.  See @al/common for more information.
   */
  /* istanbul ignore next */
  public setLocations( locations:AlLocationDescriptor[], actingUri:string|boolean = true, context:AlLocationContext = null ) {
      throw new Error("Please use AlLocatorService.setLocations to update location metadata." );
  }

  /**
   * @deprecated
   *
   * Provides a concise way to set location context without importing AlLocatorService directly.
   *
   * @param {string} environment Should be 'production', 'integration', or 'development'
   * @param {string} residency Should be 'US' or 'EMEA'
   * @param {string} locationId If provided, should be one of the locations service location codes, e.g., defender-us-denver
   * @param {string} accessibleLocations If provided, should be a list of accessible locations service location codes.
   */
  /* istanbul ignore next */
  public setLocationContext( environment:string, residency?:string, locationId?:string, accessibleLocations?:string[] ) {
      throw new Error("Please use AlLocatorService.setContext to override location context." );
  }

  /**
   * @deprecated
   */
  /* istanbul ignore next */
  public resolveLocation( locTypeId:string, path:string = null, context:AlLocationContext = null ) {
    console.warn("Deprecation notice: please use AlLocatorService.resolveURL to calculate resource locations." );
    return AlLocatorService.resolveURL( locTypeId, path, context );
  }

  /**
   * Use HTTP Basic Auth
   * Optionally supply an mfa code if the user account is enrolled for Multi-Factor Authentication
   *
   * There are two variants of this method: one which executes directly against AIMS, and the other which
   * is levied against a gestalt lambda proxied through console.account.
   *
   * Under ordinary circumstances, you should *not* be calling this directly -- instead, you should use the top-level
   * `authenticate` method on @al/session's ALSession instance.
   */
  /* tslint:disable:variable-name */
  async authenticate( user: string, pass: string, mfa_code?:string, ignoreWarning?:boolean, payloadExtras?:any ):Promise<AIMSSessionDescriptor> {
    if ( ! ignoreWarning ) {
      console.warn("Warning: this low level authentication method is intended only for use by other services, and will not create a reusable session.  Are you sure you intended to use it?" );
    }
    let payload:any = {};
    if ( payloadExtras && typeof( payloadExtras ) === 'object' ) {
      payload = { ...payload, ...payloadExtras };
    }
    if (mfa_code) {
      payload.mfa_code = mfa_code;
    }
    return this.post( {
      service_stack: AlLocation.GlobalAPI,
      service_name: 'aims',
      path: 'authenticate',
      version: 'v1',
      headers: {
        Authorization: `Basic ${this.base64Encode(`${user}:${pass}`)}`
      },
      data: payload,
      withCredentials: true
    });
  }

  async authenticateViaGestalt( user:string, pass:string, ignoreWarning?:boolean, payloadExtras?:any ):Promise<AIMSSessionDescriptor> {
    let data:any = {
      authorization: `Basic ${this.base64Encode(`${user}:${pass}`)}`
    };
    if ( payloadExtras && typeof( payloadExtras ) === 'object' ) {
        data.payloadExtras = payloadExtras;
    }
    return this.post( {
      data,
      url: this.getGestaltAuthenticationURL(),
      withCredentials: true,
      responseType: "json"
    } );
  }

  /**
   * Authenticate with an mfa code and a temporary session token.
   * Used when a user inputs correct username:password but does not include mfa code when they are enrolled for Multi-Factor Authentication
   * The session token can be used to complete authentication without re-entering the username and password, but must be used within 3 minutes (token expires)
   *
   * There are two variants of this method: one which executes directly against AIMS, and the other which
   * is levied against a gestalt lambda proxied through console.account.
   *
   * Under ordinary circumstances, you should *not* be calling this directly -- instead, you should use the top-level
   * `authenticateWithMFASessionToken` method on @al/session's ALSession instance.
   */
  /* tslint:disable:variable-name */
  async authenticateWithMFASessionToken(sessionToken: string, mfa_code: string, ignoreWarning?:boolean):Promise<AIMSSessionDescriptor> {
    if ( ! ignoreWarning ) {
      console.warn("Warning: this low level authentication method is intended only for use by other services, and will not create a reusable session.  Are you sure you intended to use it?" );
    }
    return this.post( {
      service_stack: AlLocation.GlobalAPI,
      service_name: 'aims',
      path: 'authenticate',
      version: 'v1',
      headers: {
        'X-AIMS-Session-Token': sessionToken
      },
      data: {
        mfa_code: mfa_code
      },
      withCredentials: true
    } );
  }

  async authenticateWithMFAViaGestalt( sessionToken:string, mfaCode:string ):Promise<AIMSSessionDescriptor> {
    return this.post( {
      url: this.getGestaltAuthenticationURL(),
      withCredentials: true,
      data: {
        sessionToken: sessionToken,
        mfaCode: mfaCode
      }
    } );
  }

  async acceptTermsOfService( sessionToken:string, ignoreWarning?:boolean, acceptTOS:boolean = true ):Promise<AIMSSessionDescriptor> {
    if ( ! ignoreWarning ) {
      console.warn("Warning: this low level authentication method is intended only for use by other services, and will not create a reusable session.  Are you sure you intended to use it?" );
    }
    return this.post( {
      service_stack: AlLocation.GlobalAPI,
      service_name: 'aims',
      path: 'authenticate',
      version: 'v1',
      headers: {
        'X-AIMS-Session-Token': sessionToken
      },
      data: {
        accept_tos: acceptTOS
      },
      withCredentials: true
    } );
  }

  async acceptTermsOfServiceViaGestalt( sessionToken:string, acceptTOS:boolean = true ):Promise<AIMSSessionDescriptor> {
    return this.post( {
      url: this.getGestaltAuthenticationURL(),
      withCredentials: true,
      data: {
        sessionToken: sessionToken,
        acceptTOS: acceptTOS
      }
    } );
  }

  /**
   * Converts a string input to its base64 encoded equivalent.
   */
  public base64Encode( data:string ):string {
    let utf8Data = unescape( encodeURIComponent( data ) );        //  forces conversion to utf8 from utf16, because...  not sure why
    let bytes = [];
    for ( let i = 0; i < utf8Data.length; i++ ) {
      bytes.push( utf8Data.charCodeAt( i ) );
    }
    let result = base64JS.fromByteArray( bytes );
    return result;
  }

  public async normalizeRequest(config: APIRequestParams):Promise<APIRequestParams> {
    if ( ! config.url ) {
      if ( 'target_endpoint' in config || 'service_name' in config || 'service_stack' in config ) {
        // If we are using endpoints resolution to determine our calculated URL, merge globalServiceParams into our configuration
        config = this.merge( {}, this.globalServiceParams, config );
        config.url = await this.calculateRequestURL( config );
      } else {
        console.warn("Warning: malform request descriptor lacks a URL or properties to generate one", config );
      }
    }
    if (config.accept_header) {
      console.warn("Deprecation warning: please do not use accept_header shortcut mechanism." );
      if ( ! config.headers ) {
        config.headers = {};
      }
      config.headers.Accept = config.accept_header;
      delete config.accept_header;
    }
    if (config.response_type) {
      config.responseType = config.response_type as any;
      delete config.response_type;
    }
    return config;
  }

  public getCachedData():any {
    this.storage.synchronize();     //  flush any expired data
    return this.storage.data;
  }

  public getExecutionRequestLog():APIExecutionLogItem[] {
    return this.executionRequestLog;
  }

  public mergeCacheData( cachedData:any ) {
    this.storage.data = deepMerge( this.storage.data, cachedData );
    this.storage.synchronize();
  }

  public isResponse( instance:any ):instance is AxiosResponse {
    if ( instance.hasOwnProperty("status")
            && instance.hasOwnProperty('statusText')
            && instance.hasOwnProperty('headers' )
            && instance.hasOwnProperty( 'config' )
            && instance.hasOwnProperty( 'data' ) ) {
      return true;
    }
    return false;
  }

  public logResponse( response:AxiosResponse, includeCurl:boolean = false ) {
      console.log(`Received HTTP ${response.status} (${response.statusText}) from [${response.config.method} ${response.config.url}]` );
      if ( response.data ) {
          console.log("Response data: " + JSON.stringify( response.data, null, 4 ) );
      }
      if ( includeCurl ) {
          console.log(`CURL command to reproduce: ${this.requestToCurlCommand( response.config, true )}` );
      }
  }

  public requestToCurlCommand( config:AxiosRequestConfig, prettify:boolean = true ):string {
    let continuation = prettify ? "\\\r\n    " : " ";
    let command = `curl -X ${config.method} "${config.url}" ${continuation}`;
    for ( let header in config.headers ) {
      command = command + `   -H "${header}: ${config.headers[header]}" ${continuation}`;
    }
    if ( config.data ) {
      command = command + `   --data "${JSON.stringify(config.data).replace( /"/, '\"' )}"`;
    }
    command = command + `    --verbose`;
    return command;
  }

  public async simulateHttpError<ResponseType = any>( request:Promise<any>,
                                                      status:number,
                                                      statusText:string,
                                                      data:any,
                                                      headers:any = {} ):Promise<ResponseType> {
      const actualResponse = await request;
      const lastRequest:AxiosRequestConfig = this.executionRequestLog.length > 0 ? this.executionRequestLog[this.executionRequestLog.length - 1] : { method: "GET", url: "/nothing" };

      const error: AxiosResponse = {
          status,
          statusText,
          headers,
          data,
          config: lastRequest,
      };

      throw error;
  }

  /**
   * Resolves accumulated endpoints data for the given account.
   *
   * Update Feb 2021
   * ---------------
   * This has been overhauled to deal with services whose endpoints now must be determined for the current context residency (selected datacenter location in UI).
   * The reason for this is to cater for scenarios where a parent account manages children that are located across different geographical locations to one another and therefore
   * any data retrieval for views in the UI where child account roll-ups exist must be fetched from the appropriate location.
   * The previous implementation ALWAYS calculated service endpoints for the default location of the primary account for the logged in user and so any roll ups for views for child accounts never worked eva!!!
   *
   */
  public async resolveDefaultEndpoints( accountId:string, serviceList:string[] ) {
    if (accountId === '0') {
      this.fallbackResolveEndpoints( accountId, serviceList, AlApiClient.defaultResidency );
    } else {
      try {
        const context = AlLocatorService.getContext();
        const endpointsRequest:APIRequestParams = {
          method: "POST",
          url: AlLocatorService.resolveURL( AlLocation.GlobalAPI, `/endpoints/v1/${accountId}/residency/default/endpoints` ),
          data: serviceList,
          aimsAuthHeader: true
        };
        let response = await this.axiosRequest( endpointsRequest );
        let endpointsLookup: AlEndpointsDictionary = {};
        Object.entries( response.data ).forEach( ( [ serviceName, endpointHost ] ) => {
            let host = endpointHost as string;
            if ( host.startsWith("async.") ) { // naming convention for WebSocket services
              host = `wss://${host}`; // add prefix for websocket protocol
            } else if ( !host.startsWith("http") ) {
              host = `https://${host}`;      //  ensuring domains are prefixed with protocol
            }
            setJsonPath( this.endpointCache,
                         [ context.environment, accountId, serviceName, AlApiClient.defaultResidency ],
                         host );
        } );
        // console.log(`resolveDefaultEndpoints() => endpointCache: `, this.endpointCache);
        return this.endpointCache;
      } catch ( e ) {
        this.fallbackResolveEndpoints( accountId, serviceList, AlApiClient.defaultResidency );
        // console.error(`resolveDefaultEndpoints() => endpointCache: `, this.endpointCache);
      }
    }
  }

  public async resolveResidencyAwareEndpoints( accountId:string, serviceList:string[] ) {
    try {
      const context = AlLocatorService.getContext();
      const endpointsRequest:APIRequestParams = {
        method: "POST",
        url: AlLocatorService.resolveURL( AlLocation.GlobalAPI, `/endpoints/v1/${accountId}/endpoints` ),
        data: serviceList,
        aimsAuthHeader: true
      };
      let response = await this.axiosRequest( endpointsRequest );
      Object.entries( response.data ).forEach( ( [ serviceName, residencyLocations ] ) => {
          Object.entries(residencyLocations).forEach(([residencyName, residencyHost]) => {
              Object.entries(residencyHost).forEach(([datacenterId, endpointHost]) => {
                let host = endpointHost as string;
                if ( host.startsWith("async.") ) { // naming convention for WebSocket services
                  host = `wss://${host}`; // add prefix for websocket protocol
                  console.warn("host", host);
                } else if ( !host.startsWith("http") ) {
                  host = `https://${host}`;      //  ensuring domains are prefixed with protocol
                }
                setJsonPath( this.endpointCache,
                             [ context.environment, accountId, serviceName, residencyName ],
                             host );
              } );
          } );
      } );
      return this.endpointCache;
    } catch( e ) {
      this.fallbackResolveEndpoints( accountId, serviceList, AlLocatorService.getCurrentResidency() );
    }
  }


  public lookupDefaultServiceEndpoint(accountId: string, serviceName: string) {
        const context = AlLocatorService.getContext();
        return getJsonPath<string>( this.endpointCache,
                [ context.environment, accountId, serviceName, AlApiClient.defaultResidency ],
            null );
  }

  public setInterceptionRules( rules:AlInterceptionRules|AlInterceptionRule[]|AlInterceptionRule|undefined ) {
      if ( rules instanceof AlInterceptionRules ) {
          this.interceptionRules = rules;
      } else if ( rules === undefined ) {
          delete this.interceptionRules;
      } else if ( Array.isArray( rules ) ) {
          this.interceptionRules = new AlInterceptionRules( rules );
      } else if ( typeof( rules ) === 'object' ) {
          this.interceptionRules = new AlInterceptionRules( [ rules ] );
      }
  }

  public setBeforeRequest( handler?:{():Promise<any>} ) {
    this.beforeRequest = handler;
  }

  protected getGestaltAuthenticationURL():string {
      let residency = 'US';
      let environment = AlLocatorService.getCurrentEnvironment();
      if ( environment === 'development' ) {
          environment = 'integration';
      }
      let authLocationId = AlRuntimeConfiguration.options.gestaltLocationId ?? AlLocation.MagmaUI;
      return AlLocatorService.resolveURL( authLocationId, `/session/v1/authenticate`, { residency, environment } );
  }


  protected async calculateRequestURL( params: APIRequestParams ):Promise<string> {
    let fullPath:string = null;
    if ( ! params.noEndpointsResolution
           && ! AlRuntimeConfiguration.options.noEndpointsResolution
           && ( params.target_endpoint || ( params.service_name && this.endpointsStackWhitelist.includes( params.service_stack ) ) ) ) {
      // Utilize the endpoints service to determine which location to use for this service/account pair
      fullPath = await this.prepare( params );
    }
    if ( ! fullPath ) {
      // If specific endpoints are disabled or unavailable, use the environment-level default
      fullPath = AlLocatorService.resolveURL( params.service_stack );
    }
    if ( params.service_prefix ) {
      fullPath += `/${params.service_prefix}`;
    }
    if ( params.service_name ) {
        if ( params.service_stack === AlLocation.MDRAPI && fullPath.includes( "{service}" ) ) {
            fullPath = fullPath.replace( "{service}", params.service_name );
        } else if ( params.service_stack !== AlLocation.MDRAPI ) {
            fullPath += `/${params.service_name}`;
        }
    }
    if ( params.version ) {
      if ( typeof( params.version ) === 'string' && params.version.length > 0 ) {
        fullPath += `/${params.version}`;
      } else if ( typeof( params.version ) === 'number' && params.version > 0 ) {
        fullPath += `/v${params.version.toString()}`;
      }
    }
    if (params.account_id && params.account_id !== '0') {
      fullPath += `/${params.account_id}`;
    }
    if (params.hasOwnProperty('path') && params.path.length > 0 ) {
      fullPath += ( params.path[0] === '/' ? '' : '/' )  + params.path;
    }
    return fullPath;
  }

  /**
   * This method (and its partner, getServiceEndpoints) uses running promise sequences to retrieve endpoints (using the multiple endpoint lookup action)
   * in such a way that
   *    a) most basic services will be retrieved in a single call
   *    b) the initial call is guaranteed to included the service a request is being formed for
   *    c) only one outstanding call to the endpoints service will be issued, per account, at a given time
   *
   * @returns The resolved base URL of the given endpoint.
   */
  protected async prepare( requestParams:APIRequestParams ): Promise<string> {
    let result = await this.endpointsGuard.run<string>( async () => {
      let environment         =   AlLocatorService.getCurrentEnvironment();
      let accountId           =   requestParams.context_account_id || requestParams.account_id || this.defaultAccountId || "0";
      let serviceEndpointId   =   requestParams.target_endpoint || requestParams.service_name;
      let residency           =   requestParams.residency ?? "default";
      let residencyAware      =   AlApiClient.resolveByResidencyServiceList.includes( serviceEndpointId )
                                    || ! [ undefined, null, 'default' ].includes( requestParams.residency );      //  specific residency zone forces residency aware lookup

      if ( residencyAware && residency === 'default' ) {
          residency = AlLocatorService.getCurrentResidency();
      } else if ( residency !== 'default' ) {
          residencyAware = true;
      }

      let baseURL = getJsonPath<string>( this.endpointCache,
                                         [ environment, accountId, serviceEndpointId, residency ],
                                         null );
      if ( baseURL ) {
        return baseURL;
      }

      let serviceList = residencyAware ? AlApiClient.resolveByResidencyServiceList : AlApiClient.defaultServiceList;
      if ( ! serviceList.includes(serviceEndpointId)) {
          serviceList.push(serviceEndpointId);
      }

      if ( residencyAware ) {
        await this.resolveResidencyAwareEndpoints( accountId, serviceList );
      } else {
        await this.resolveDefaultEndpoints( accountId, serviceList );
      }
      baseURL = getJsonPath<string>( this.endpointCache,
                                         [ environment, accountId, serviceEndpointId, residency ],
                                         null );
      if ( baseURL ) {
        return baseURL;
      }
      console.log(`WARNING: unable to resolve location of endpoint '${serviceEndpointId}' for account ${accountId} (${residencyAware ? "residency-aware" : "default mode"})` );
      return null;
    } );
    return result;
  }

  protected fallbackResolveEndpoints( accountId:string, serviceList:string[], residency:string ) {
    let context = AlLocatorService.getContext();
    console.warn(`Could not retrieve data for endpoints for [${serviceList.join(",")}]; using defaults for environment '${context.environment}'` );
    let insightHost = AlLocatorService.resolveURL( AlLocation.InsightAPI );
    serviceList.forEach( serviceName => {
        setJsonPath( this.endpointCache,
                     [ context.environment, accountId, serviceName, residency ],
                     insightHost );
    } );
    return this.endpointCache;
  }

  /**
   * Instantiate a properly configured axios client for services
   */
  protected getAxiosInstance(): AxiosInstance {
    if ( this.instance ) {
      return this.instance;
    }

    let headers = {
      'Accept': 'application/json, text/plain, */*'
    };

    this.instance = axios.create({
      timeout: 0,
      withCredentials: false,
      headers: headers,
      paramsSerializer: params => this.normalizeQueryParams(params).replace('?','')
    });

    this.instance.interceptors.request.use(
      ( config:APIRequestParams ) => {
        if ( config.service_stack === AlLocation.LegacyUI ) {
          config.withCredentials = true;
        }
        this.events.trigger( new AlClientBeforeRequestEvent( config ) );        //    Allow event subscribers to modify the request (e.g., add a session token header) if they want
        if ( ! this.isBrowserBased() ) {
            config.headers['Origin'] = AlLocatorService.resolveURL( AlLocation.MagmaUI );
        }
        config.validateStatus = ( responseStatus:number ) => {
            //  This forces all responses to run through our response interceptor
            return true;
        };
        return config;
      }
    );
    this.instance.interceptors.response.use( response => this.onRequestResponse( response ) );
    return this.instance;
  }

  protected onRequestResponse = async ( response:AxiosResponse ):Promise<AxiosResponse> => {
    if ( this.interceptionRules ) {
      let substitution = await this.interceptionRules.apply( response );
      if ( substitution ) {
        response = substitution;
      }
    }
    if ( response.status < 200 || response.status >= 400 ) {
      return this.onRequestError( response );
    }
    return Promise.resolve( response );
  }

  protected onRequestError = ( errorResponse:AxiosResponse ):Promise<any> => {
    this.lastError = errorResponse;
    if ( errorResponse.status >= 500 ) {
        //  TODO: dispatch service error event
    } else if ( errorResponse.status >= 400 ) {
        //  TODO: dispatch client request error event
    } else if ( errorResponse.status < 200 ) {
        //  TODO: not quite sure...
    }
    let snapshot:any = {
      status: errorResponse.status,
      statusText: errorResponse.statusText,
      url: errorResponse.config.url,
      headers: errorResponse.config.headers,
      data: errorResponse.data
    };
    this.log( `APIClient Failed Request Snapshot: ${JSON.stringify( snapshot, null, 4 )}` );
    this.events.trigger( new AlClientAPIErrorEvent( errorResponse.config, errorResponse ) );
    return Promise.reject( errorResponse );
  }

  /**
   * Inner request method.  If automatic retry is enabled via the retry_count property of the request config, this method
   * will catch errors of status code 0/3XX/5XX and retry them at staggered intervals (by default, a factorial delay based on number of retries).
   * If any of these requests succeed, the outer promise will be satisfied using the successful result.
   */
  protected async axiosRequest<ResponseType = any>( config:APIRequestParams, attemptIndex:number = 0 ):Promise<AxiosResponse<ResponseType>> {
    const ax = this.getAxiosInstance();
    if ( config.curl && this.verbose ) {
      console.log( config );
      console.log( this.requestToCurlCommand( config ) );
    }
    if ( this.mockMode ) {
        return new Promise( ( resolve, reject ) => {
            this.mockRequests.push( { resolve, reject, request:config, method: config.method ?? "GET", url: config.url ?? "uncalculated" } );
        } );
    }
    if ( this.beforeRequest ) {
        await this.beforeRequest();
    }
    return ax( config ).then( response => {
                                if ( attemptIndex > 0 ) {
                                  console.warn(`Notice: resolved request for ${config.url} with retry logic.` );
                                }
                                return response;
                              },
                              error => {
                                if ( this.isRequestTimeout( error, config ) ) {
                                  return Promise.reject( new AlGatewayTimeoutError( error.message, config.service_name || 'unknown', config ) );
                                } else if ( this.isRetryableError( error, config, attemptIndex ) ) {
                                  attemptIndex++;
                                  const delay = Math.floor( ( config.retry_interval ? config.retry_interval : 1000 ) * attemptIndex );
                                  return new Promise<AxiosResponse>( ( resolve, reject ) => {
                                    AlStopwatch.once(   () => {
                                                          config.params = config.params || {};
                                                          config.params.breaker = this.generateCacheBuster( attemptIndex );
                                                          this.axiosRequest( config, attemptIndex + 1 ).then( resolve, reject );
                                                        },
                                                        delay );
                                  } );
                                }
                                return Promise.reject( error );
                              } )
                        .catch( exception => {
                          if ( this.isRequestTimeout( exception, config ) ) {
                            return Promise.reject( new AlGatewayTimeoutError( exception.message, config.service_name || 'unknown', config ) );
                          } else if ( this.isRetryableError( null, config, attemptIndex ) ) {
                            attemptIndex++;
                            const delay = Math.floor( ( config.retry_interval ? config.retry_interval : 1000 ) * attemptIndex );
                            return new Promise<AxiosResponse>( ( resolve, reject ) => {
                              AlStopwatch.once(   () => {
                                                    config.params = config.params || {};
                                                    config.params.breaker = this.generateCacheBuster( attemptIndex );
                                                    this.axiosRequest( config, attemptIndex + 1 ).then( resolve, reject );
                                                  },
                                                  delay );
                            } );
                          }
                          return Promise.reject( exception );
                        } );
  }

  /**
   * Utility method to determine whether a given response is a retryable error.
   */
  protected isRetryableError( error:AxiosResponse, config:APIRequestParams, attemptIndex:number ) {
    if ( ! config.hasOwnProperty("retry_count" ) || attemptIndex >= config.retry_count ) {
      return false;
    }
    if ( ! error ) {
      console.warn( `Notice: will retry request for ${config.url} (null response condition)` );
      return true;
    }
    if ( error.status === 0
          || ( error.status >= 300 && error.status <= 399 )
          || ( error.status >= 500 && error.status <= 599 ) ) {
      console.warn( `Notice: will retry request for ${config.url} (${error.status} response code)` );
      return true;
    }
    return false;
  }

  protected isRequestTimeout( error:any, config:APIRequestParams ) {
    return 'code' in error && error.code === 'ECONNABORTED' && config.timeout;
  }

  /**
   * Generates a random cache-busting parameter
   */
  protected generateCacheBuster( attemptIndex:number ) {
    const verbs = ['debork', 'breaker', 'breaker-breaker', 'fix', 'unbork', 'corex', 'help'];
    const verb = verbs[Math.floor( Math.random() * verbs.length )];
    const hash = ( Date.now() % 60000 ).toString() + Math.floor( Math.random() * 100000 ).toString();
    return `${verb}-${hash}-${attemptIndex.toString()}`;
  }

  /**
   * Normalize query parameters from config api request.
   */
  private normalizeQueryParams(params: any) {
    try {
        let queryParams = '';
        if ( params ) {
          queryParams = Object.entries( params )
                              .map( ( [ p, v ] ) => {
                                if ( typeof( v ) === 'undefined' ) {
                                    return null;
                                }
                                if( Array.isArray(v) ) {
                                  return v.map( ( arrayValue ) => {
                                    return `${p}=${encodeURIComponent( typeof( arrayValue ) === 'string' ? arrayValue : arrayValue.toString() )}`;
                                  }).join("&");
                                }
                                return `${p}=${encodeURIComponent( typeof( v ) === 'string' ? v : v.toString() )}`;
                              })
                              .filter( p => p )
                              .join("&");
        }
        return `${queryParams.length>0?'?'+queryParams:''}`;
    } catch( e ) {
        console.error( e );
        return '';
    }
  }

  /**
   *
   */
  private getCachedValue<ResponseType = any>( key:string):ResponseType {
    return this.storage.get( key ) as ResponseType;
  }

  private setCachedValue( key:string, data:any, ttl:number ):void {
    if ( ttl < 1000 ) {
      return;
    }
    this.storage.set( key, data, Math.floor( ttl / 1000 ) );
  }

  private deleteCachedValue( key:string ):void {
    this.storage.delete( key );
  }

  /**
   * Are we running in a browser?
   */
  private isBrowserBased() {
    if (typeof window === 'undefined') {
      return false;
    }
    return true;
  }

  private log( text:string, ...otherArgs:any[] ) {
    if ( this.verbose ) {
        console.log.apply( console, (arguments as any) );
    }
  }

  /**
   * Performs a shallow merge from any number of source objects to a single target object, and returns that target object.
   * Essentially a cheap-and-easy replacement for Object.assign.
   */
  private merge( target:any, ...sources:any[] ):any {
    sources.forEach( source => {
      if ( typeof( source ) !== 'object' || source === null ) {
        return;
      }
      Object.entries( source ).forEach( ( [ key, value ] ) => {
        target[key] = value;
      } );
    } );
    return target;
  }

}

/* tslint:disable:variable-name */
export const AlDefaultClient = AlGlobalizer.instantiate( 'AlDefaultClient', () => new AlApiClient() );
