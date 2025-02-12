/**
 *  @author Kevin Nielsen <knielsen@alertlogic.com>
 *  @author Robert Parker <robert.parker@alertlogic.com>
 *
 *  @copyright Alert Logic, Inc 2019
 */

import { WebAuth } from 'auth0-js';
import Keycloak, { KeycloakLoginOptions, KeycloakOnLoad } from 'keycloak-js';
import { AlBehaviorPromise, AlCabinet, AlStopwatch } from '../../common';
import { AlLocation, AlLocatorService } from '../../navigation';
import { AlErrorHandler } from '../../error-handler';
import { AlRuntimeConfiguration } from '../../configuration';
import { AlDefaultClient } from '../../client';
import { AlConduitClient } from './al-conduit-client';

export class AlIdentityProviders
{
    /**
     *  Keycloak and Auth0 client instances
     */
    protected static keycloak:Keycloak = undefined;
    protected static auth0:WebAuth = undefined;
    protected static cachedA0UserInfo:{[accessKey:string]:any};
    protected storage = AlCabinet.persistent("alnav");
    protected allIsLost = false;

    constructor() {
    }

    public static inAuth0Workflow( url:string ):boolean {
        if ( ! url ) {
            return false;
        }
        if ( ! /state=([a-zA-Z0-9\-_]+)/.test( url ) ) {    //  this parameter must always be present
            return false;
        }
        if ( /iss=([^&]+)/.test( url ) ) {                  //  this parameter suggests we're in a keycloak redirection flow
            return false;
        }
        return true;
    }

    public static usingTokenInjection( url:string ):boolean {
        return /\?.*aims_token=[a-zA-Z0-9\-+]+/.test( url );
    }

    /**
     * This method initializes IdP clients using a heuristic mechanism differentiating auth0 from keycloak.
     * This allows those clients to initiate and/or respond to redirection based OIDC authentication before the application
     * itself is bootstrapped and the angular router assumes control of the URL.
     */

    public async warmup( url?:string ):Promise<string|undefined> {
        let targetURL = url ?? window?.location?.href ?? '';
        if ( AlIdentityProviders.inAuth0Workflow(window?.location?.href) ) {
            try {
                let authenticator = await this.getAuth0Authenticator();
                let config = this.getAuth0Config( { usePostMessage: true, prompt: 'none' } );
                let accessToken = await this.getAuth0SessionToken( authenticator, config, 5000 );
            } catch( e ) {
                AlErrorHandler.log(e, "IdP Warmup: auth0 initialization failed", "auth" );
            }
            return this.maybeRewriteBrokenURL( targetURL );
        } else if ( ! AlIdentityProviders.usingTokenInjection( targetURL ) ) {
            await this.getKeycloak();
        }
    }

    /**
     * Retrieve a keycloak authentication interface.
     */
    public async getKeycloak():Promise<Keycloak> {
        if ( ! AlIdentityProviders.keycloak ) {
            const fortraPlatformUri = AlLocatorService.resolveURL( AlLocation.FortraPlatform, '/idp' );
            AlIdentityProviders.keycloak = new Keycloak( {
                url: fortraPlatformUri,
                realm: 'products',
                clientId: 'alertlogic-aims-public',
            } );
            if ( AlRuntimeConfiguration.options.embeddedFortraApp ) {
                await AlIdentityProviders.keycloak.init( { enableLogging: true } );     //  prevent redirections when running as an embedded application
            } else {
                await this.innerGetKeyCloak( AlIdentityProviders.keycloak );            //  allows redirection to check for session existence
            }
        }
        return AlIdentityProviders.keycloak;
    }

    /**
     * Retrieve a reference to the Auth0 web auth instance.  This code is excluded from unit testing.
     */
    /* istanbul ignore next */
    public getAuth0Authenticator():WebAuth {
        if ( AlIdentityProviders.auth0 === undefined ) {
            /* Because Auth0 persists itself as a global, we will need to cast it from <any>window.auth.  Fun stuff :/ */
            let w = <any>window;
            if ( ! w.auth0 ) {
                console.warn( "Could not find the auth0 global object; is Auth0 installed?" );
                AlIdentityProviders.auth0 = null;
                return null;
            }
            let authenticator = <WebAuth>new w.auth0.WebAuth( this.getAuth0Config() );
            if ( ! authenticator.hasOwnProperty("client" ) ) {
                //  Stop for this error, bad build?
                throw new Error("auth0.WebAuth instance does not have a client property; wrong version perhaps?" );
            }
            AlIdentityProviders.auth0 = authenticator;
        }
        return AlIdentityProviders.auth0;
    }

    /**
     * Uses a race to make sure that auth0 session detection doesn't time out -- since a misconfigured client can cause the
     * promise to hang indefinitely.
     */
    public async getAuth0SessionToken( authenticator:WebAuth, config:any, timeout:number = 5000 ):Promise<string> {
      return Promise.race( [ AlStopwatch.promise( timeout ),
                             new Promise<string>( ( resolve, reject ) => {
                               authenticator.checkSession( config, ( error, authResult ) => {
                                   if ( error || ! authResult || ! authResult.accessToken ) {
                                       console.log( "Raw Auth0 response: ", error, authResult );
                                       reject("auth0's checkSession method failed with an error" );
                                   } else {
                                       resolve( authResult.accessToken );
                                   }
                               } );
                           } ) ] )
                      .then( ( accessToken:string|any ) => {
                          if ( accessToken && typeof( accessToken ) === 'string' ) {
                              return accessToken;
                          }
                          return Promise.reject("checkSession returned false or could not complete execution before timeout." );
                      } );
    }

    /**
     * Calculates the correct auth0 configuration to use.
     */
    public getAuth0Config( merge:any = {} ):any {
        let w = <any>window;
        let auth0Node = AlLocatorService.getNode( AlLocation.Auth0 );
        if ( ! auth0Node || ! auth0Node.data || ! auth0Node.data.hasOwnProperty( 'clientID' ) ) {
            throw new Error("Service matrix does not reflect an auth0 node; check your app configuration." );
        }
        return Object.assign(   {
                                    domain:         auth0Node.uri,
                                    clientID:       auth0Node.data.clientID,
                                    responseType:   'token id_token',
                                    audience:       'https://alertlogic.com/',
                                    scope:          'openid user_metadata',
                                    prompt:         true,
                                    redirectUri:    w.location.origin
                                },
                                merge );
    }

    /**
     * Uses a race to make sure that keycloak initialization doesn't time out -- since a misconfigured client can cause the
     * promise to hang indefinitely.
     */
    protected async innerGetKeyCloak( cloak:Keycloak, timeout:number = 5000 ):Promise<void> {
        return Promise.race( [ AlStopwatch.promise( timeout ),
                               new Promise<void>( async ( resolve, reject ) => {
                                    let cloakPhase = this.storage.get("cloakInitPhase", 0 );
                                    const baseLocation = window.location.origin + ( window.location.pathname === '/' ? '' : window.location.pathname );     //  fix double slash but support apps in subdirectories

                                    let onLoad:KeycloakOnLoad|undefined = cloakPhase === 0 ? "check-sso" : undefined;
                                    let silentCheckSsoRedirectUri = cloakPhase === 0 ? `${baseLocation}/sso-check.html` : undefined;
                                    this.storage.set("cloakInitPhase", cloakPhase + 1, 10 ).synchronize();  //  doing this preemptively should prevent us from

                                    if ( cloakPhase > 5 ) {
                                        this.allIsLost = true;
                                        AlErrorHandler.log("Refusing to initialize keycloak after too many redirect cycles", "auth" );
                                        resolve();
                                    } else {
                                        AlErrorHandler.log(`Initializing cloak in phase [${cloakPhase}]: ${onLoad} (uri: ${window.location.href})`, "auth");
                                        let initResult = await cloak.init( {
                                                                        onLoad,
                                                                        silentCheckSsoRedirectUri,
                                                                        enableLogging: true,
                                                                        checkLoginIframe: true,
                                                                        checkLoginIframeInterval: 30,
                                                                        pkceMethod: 'S256',
                                                                        responseMode: "query",
                                                                        messageReceiveTimeout: 5000
                                                                    } );
                                        if ( ! initResult && cloakPhase === 0 ) {
                                            cloak.login( { prompt: 'none', redirectUri: window.location.href } );
                                        } else {
                                            resolve();
                                        }
                                    }
                               } ) ] );
    }


    protected getAuth0UserInfo = ( authenticator:WebAuth, userAccessToken:string, callback:(error:any, userInfo:any)=>void ) => {
        if ( AlIdentityProviders.cachedA0UserInfo.hasOwnProperty( userAccessToken ) ) {
            callback( null, AlIdentityProviders.cachedA0UserInfo[userAccessToken] );
            return;
        }

        authenticator.client.userInfo( userAccessToken, ( userInfoError, userIdentityInfo ) => {
            if ( ! userInfoError && userIdentityInfo ) {
                AlIdentityProviders.cachedA0UserInfo[userAccessToken] = userIdentityInfo;        //  cache
            }
            callback( userInfoError, userIdentityInfo );
        } );
    }

    /**
     *  Extracts necessary data from the response to auth0's getUserInfo endpoint
     */
    protected extractUserInfo = ( identityData:any ) => {
        let config = this.getAuth0Config();
        let auth0Node = AlLocatorService.getNode( AlLocation.Auth0 );
        if ( ! auth0Node || ! auth0Node.data || ! auth0Node.data.hasOwnProperty( "clientID" ) ) {
            throw new Error("Configuration's service list does not include an entry for auth0 with a 'clientID' property!; check your configuration." );
        }
        let domainIdInfo    =   "";

        if ( identityData.hasOwnProperty( config.audience ) ) {
            domainIdInfo = identityData[config.audience].sub;
        } else {
            throw new Error(`Unexpected identity data received from auth0; no audience '${config.audience}' found.` );
        }

        let userInfo = domainIdInfo.split(":");
        if ( userInfo.length !== 2 ) {
            throw new Error(`Unexpected identity data received from auth0; audience '${config.audience}' contains unexpected content '${domainIdInfo}'.` );
        }

        let accountId       =   userInfo[0];
        let userId          =   userInfo[1];
        if ( ! accountId || ! userId ) {
            throw new Error(`Unexpected identity data received from auth0; audience '${config.audience}' contains empty account or user in '${domainIdInfo}'.` );
        }
        return {
            "accountId": accountId,
            "userId": userId
        };
    }

    /**
     * Auth0 has a bad habit of generating URLs that are indigestible by @angular/router, so it is necessary to recognize some of
     * its patterns and correct them.
     */
    protected maybeRewriteBrokenURL( inputURL:string ):string|undefined {
        try {
            let verifyMfaRouteMatcher = /\?state=(.*)\#\/mfa\/verify(.*)/;
            let altVerifyMfaRouteMatcher = /\?token=(.*)&state=(.*)\#\/mfa\/verify(.*)/;
            let acceptTosRouteMatcher = /\?state=(.*)\#\/terms-of-service(.*)/;

            let node    =   AlLocatorService.getNodeByURI( inputURL );
            let nodeId  =   node?.locTypeId || 'unknown';

            if ( nodeId === AlLocation.AccountsUI || nodeId === AlLocation.MagmaUI ) {
                if ( inputURL.match( verifyMfaRouteMatcher ) ) {
                    let matches = verifyMfaRouteMatcher.exec( inputURL );
                    let stateValue = matches[1];
                    let qsValue = matches[2];
                    const delimiter = qsValue.includes("?") ? "&" : "?";
                    return inputURL.replace( verifyMfaRouteMatcher, `#/mfa/verify${qsValue}${delimiter}state=${stateValue}` );
                } else if ( inputURL.match( altVerifyMfaRouteMatcher ) ) {
                    let matches = altVerifyMfaRouteMatcher.exec( inputURL );
                    let tokenValue = matches[1];
                    let stateValue = matches[2];
                    let qsValue = matches[3];
                    const delimiter = qsValue.includes("?") ? "&" : "?";
                    return inputURL.replace( altVerifyMfaRouteMatcher, `#/mfa/verify${qsValue}${delimiter}token=${tokenValue}&state=${stateValue}` );
                } else if ( inputURL.match( acceptTosRouteMatcher ) ) {
                    let matches = acceptTosRouteMatcher.exec( inputURL );
                    let stateValue = matches[1];
                    let qsValue = matches[2];
                    const delimiter = qsValue.includes("?") ? "&" : "?";
                    return inputURL.replace( acceptTosRouteMatcher, `#/terms-of-service${qsValue}&state=${stateValue}` );
                }
            } else {
                let matches = /^(.*)\/\?error=login_required&state=(.*)(\#\/.*)$/.exec( inputURL );
                if ( matches ) {
                    //  This is an Auth0 redirect URL.  It needs to be massaged to be gracefully handled by angular.
                    let delimiter = matches[3].includes("?") ? "&" : "?";
                    const rewrittenURL = `${matches[1]}/${matches[3]}${delimiter}error=login_required&state=${matches[2]}`;
                    return rewrittenURL;
                }
            }
        } catch( e ) {
            AlErrorHandler.report( "Unexpected error: could not preprocess application URI: " + e.toString() );
            throw e;
        }
        return undefined;
    }
}
