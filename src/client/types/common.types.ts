import {
    AxiosRequestConfig,
    AxiosResponse,
    Method
} from 'axios';

/**
 * Describes an execution request with all details or verbose an tracking purposes.
 */
export interface APIExecutionLogItem {
    method?: Method;                 // Request Method.
    url?: string;                    // Request URL.
    responseCode?: number;           // Response Code.
    responseContentLength?: number;  // Response content length.
    durationMs?: number;             // Total time to send and receive request.
    errorMessage?: string;           // If something bad happens.
}

/**
 * Describes an execution request with all details or verbose an tracking purposes.
 */
export interface APIExecutionLogSummary {
    numberOfRequests?: number;  // Number of requests.
    totalRequestTime?: number;  // Total request time.
    totalBytes?: number;        // Total bytes.
}

/**
 * Describes a single request to be issued against an API.
 * Please notice that it extends the underlying AxiosRequestConfig interface,
 * whose properties are detailed in node_modules/axios/index.d.ts or at https://www.npmjs.com/package/axios#request-config.
 *
 * IMPORTANT NOTE ON ENDPOINT RESOLUTION (7.24.2020)
 *
 * The request properties `target_endpoint`, `service_stack`, `service_name`, `residency`, and `account_id`,
 * `context_account_id`, `noEndpointsResolution` are used in combination to determine how the base target URL
 * should be calculated, using the following basic rules:  If a `url` is specified explicitly or the user is not authenticated,
 * ALL of this logic will be ignored and the default endpoint values provided by AlLocatorService will be used instead.  Otherwise:
 *
 * - If `noEndpointsResolution` is set to true, endpoints resolution will be circumvented completely and AlLocatorService defaults
 *   will be used instead.
 *
 * - If `target_endpoint` is provided, that string will be used as the key of the service to resolve.  Otherwise, if `service_stack`
 *   references the Insight API stack and `service_name` is provided, then `service_name` will be used.  If neither of these
 *   conditions is met, resolution will be circumvented just as if `noEndpointsResolution` were `true`.
 *
 * - Endpoints will be resolved for `context_account_id` (if set), otherwise `account_id`, and in the absence of an explicitly
 *   indicated account, the active session's primary account ID (stored locally as `defaultAccountId`) will be used.
 *
 * - If residency is provided, it will override the residency associated with the active session's `activeDatacenter()`.
 *
 * The default behavior is influence by the default request values, which are
 *      `service_stack`: `true`
 *      `residency`: `default`
 *
 */

export interface APIRequestParams extends AxiosRequestConfig {
    /**
     *  The following parameters are used to resolve the correct service location and request path.
     *  The presence of `service_name` on a request triggers this process.
     */
    target_endpoint?:string;          //  Which endpoint should be resolved for this request?  See note about endpoint resolution above.
    service_stack?:string;            //  Indicates which service stack the request should be issued to.  This should be one of the location identifiers in @al/common's AlLocation.
    service_name?: string;            //  Which service are we trying to talk to?
    residency?: string;               //  What residency domain do we prefer?  Defaults to 'default'.
    service_prefix?: string;          //  Does this endpoint need a specific prefix before service, version, and account are integrated?  Most services should not need this, only dumb ones.
    version?: string|number|null;     //  What version of the service do we want to talk to?
    account_id?: string;              //  Which account_id's data are we trying to access/modify through the service?
    context_account_id?:string;       //  If provided, uses the given account's endpoints/residency to determine service URLs _without_ adding the account ID to the request path.

    path?: string;                    //  What is the path of the specific command within the resolved service that we are trying to interact with?
    noEndpointsResolution?:boolean;   //  If set and truthy, endpoints resolution will *not* be used before the request is issued.
    aimsAuthHeader?:boolean;          //  If `true` AND the user is authenticated, forces the addition of the X-AIMS-Auth-Token header; if `false`, suppresses the header when it would ordinarily be added.
    rawResponse?:boolean;             //  If set and truthy, the entire response object (not just its data payload) will be emitted as the result of a successful request.

    /**
     *  Should data fetched from this endpoint be cached?  0 ignores caching, non-zero values are treated as milliseconds to persist retrieved data in local memory.
     *  If provided, `cacheKey` is used to identity unique and redundant/overlapping GET requests in place of a fully qualified URL.
     */
    ttl?: number|boolean;
    cacheKey?:string;
    disableCache?:boolean;
    /**
     *  Specifies an array of alternate cache keys to clear, in a call.
     *  Example: ["/entity/info/12345","https://api.allapis.com/service/v1/2534/data"]
     *           This will delete both GET requests from browser cache and
     *           local storage cache.
     */
    flushCacheKeys?:string[];

    /**
     *  If automatic retry functionality is desired, specify the maximum number of retries and interval multiplier here.
     */
    retry_count?: number;             //  Maximum number of retries
    retry_interval?: number;          //  Delay between any two retries = attemptIndex * retryInterval, defaults to 1000ms

    curl?:boolean;                    //    Emit curl diagnostic output for this request

    /**
    * @deprecated If provided, populates Headers.Accept
    */
    accept_header?: string;

    /**
    * @deprecated If provided, is simply copied to axios' `responseType` property
    */
    response_type?: string;
}

/**
 * Simple descriptor of how specific request responses should be overridden.
 */
export interface AlInterceptionRule {
    method?:string;
    test:string|RegExp|{(request:APIRequestParams,response:AxiosResponse<any>):boolean};
    callback?:{(response:AxiosResponse<any>,rule?:AlInterceptionRule):Promise<AxiosResponse<any>|undefined>};
    probability?:number;
    status?:number;
    data?:any;
}

/**
 * Simple class to manage/test an array of interception rules.
 */
export class AlInterceptionRules {
    constructor( public rules:AlInterceptionRule[] = [] ) {
    }

    public add( rule:AlInterceptionRule ) {
        this.rules.push( rule );
    }

    public remove( rule:AlInterceptionRule ) {
        this.rules = this.rules.filter( r => r !== rule );
    }

    public match( response:AxiosResponse<any> ):AlInterceptionRule|undefined {
        let request = response.config as APIRequestParams;
        return this.rules.find( rule => {
            if ( rule.method && rule.method !== '*' && request.method !== rule.method ) {
                return false;
            }
            if ( typeof( rule.probability ) === 'number' ) {
                let dice = Math.random() * 100;
                if ( dice >= rule.probability ) {
                    return false;
                }
            }
            if ( typeof( rule.test ) === 'string' && request.url === rule.test ) {
                return true;
            } else if ( typeof( rule.test === 'function' ) ) {
                return ( rule.test as any )( request, response );
            } else if ( rule.test instanceof RegExp && rule.test.test( request.url ) ) {
                return true;
            }
            return false;
        } );
    }

    public async apply( response:AxiosResponse<any> ):Promise<AxiosResponse<any>|undefined> {
        let match = this.match( response );
        if ( match ) {
            if ( typeof( match.status ) === 'number' ) {
                response.status = match.status;
                response.data = match.data || response.data;
                return Promise.reject( response );
            } else if ( match.callback ) {
                let substitution = await match.callback( response, match );
                if ( substitution ) {
                    return substitution;
                }
            }
        }
        return undefined;
    }
}

/**
 * Generates an interception rule that will cause random failures {{probability}}% of the time.
 * If status is 0 (default behavior), a random error code will be generated.
 */
export function randomAPIFailure( probability:number, status:number = 0, data?:any ):AlInterceptionRule {
    const failureStatusCodes = [ 400, 401, 403, 404, 410, 500, 501, 502, 503, 504 ];
    const excludePatterns = [
        /\/endpoints\/v1/,
        /\/aims\/v1/,
        /\/subscriptions\/v1/
    ];
    return {
        probability,
        test: ( request:APIRequestParams, response:AxiosResponse<any> ):boolean => {
            //  Prevent triggering failures for things that we depend on just to run an application -- AIMS, endpoints, subscriptions, etc.
            let excluded = excludePatterns.find( pattern => pattern.test( request.url ) );
            return ! excluded;
        },
        callback: ( response:AxiosResponse<any>, rule? ) => {
            if ( status === 0 ) {
                status = failureStatusCodes[Math.floor( Math.random() * failureStatusCodes.length )];
            }
            console.log(`Warning: simulating ${status} error for ${response.config.method} ${response.config.url} (probabiliy: ${probability}%)` );
            response.status = status;
            response.data = data || response.data || {};
            return Promise.reject( response );
        }
    };
}
