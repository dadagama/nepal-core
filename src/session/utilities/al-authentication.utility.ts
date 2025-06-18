import { AlDefaultClient, APIRequestParams } from '../../client';
import { AlSession } from '../al-session';
import { AlLocatorService, AlLocation } from '../../navigation';
import { AIMSClient, AIMSSessionDescriptor, FortraSession, AIMSAuthentication } from '../../aims-client/index';
import { AlRuntimeConfiguration } from '../../configuration';
import { AlConduitClient } from './al-conduit-client';
import { getJsonPath } from '../../common/utility';
import { AxiosResponse } from 'axios';

/**
 * Each of these is a possible outcome of an authentication attempt.
 */
export enum AlAuthenticationResult {
    Unauthenticated         = 'unauthenticated',
    Authenticated           = 'authenticated',
    AccountLocked           = 'account_locked',
    AccountUnavailable      = 'account_unavailable',
    PasswordResetRequired   = 'password_expired',
    MFAEnrollmentRequired   = 'mfa_enrollment_required',
    MFAVerificationRequired = 'mfa_verification_required',
    TOSAcceptanceRequired   = 'eula_acceptance_required',
    TOSReacceptanceRequired = 'eula_reacceptance_required',
    FortraIdPRequired       = 'fidp_required',
    InvalidCredentials      = 'failed'
}

export interface AlAuthenticationState {
    /**
     * The result of an authentication attempt.  Please don't access this directly; use AlAuthenticationUtility's
     * `getResult()` method to be assured of the correct value.
     */
    result?:AlAuthenticationResult;

    /**
     * MFA and TOS authentication criteria will both provide the user with a temporary "session token" (passed to AIMS as an
     * X-AIMS-Session-Token header.
     */
    sessionToken?:string;

    /**
     * Password reset requires a username parameter
     */
    userName?:string;

    /**
     * TOS authentication criteria will provide a URL where the current terms of service can be retrieved.
     */
    termsOfServiceURL?:string;

    /**
     * TOS api will provide the deferral to accept the terms.
     */
    deferralTOSPeriodEnd?:string;
}

export class AlAuthenticationUtility {

    public state:AlAuthenticationState = {
        result: AlAuthenticationResult.Unauthenticated
    };
    public conduit = new AlConduitClient();

    constructor( state?:AlAuthenticationState ) {
        if ( state ) {
            this.state = Object.assign( this.state, state );
        }
        this.conduit.start();
    }

    /**
     * Primary authentication method -- attempts to authenticate using a username and password.
     */
    public async authenticate( userName:string, passPhrase:string, payloadExtras?:any ):Promise<AlAuthenticationResult> {
        let useGestalt = ! AlRuntimeConfiguration.options.noGestaltAuthentication;
        if ( useGestalt ) {
            try {
                let session = await AlDefaultClient.authenticateViaGestalt( userName, passPhrase, true, payloadExtras );
                return await this.finalizeSession( session );
            } catch( e ) {
                if ( this.handleAuthenticationFailure( e ) ) {
                    return this.state.result;
                }
            }
        }

        try {
            let session = await AlDefaultClient.authenticate( userName, passPhrase, undefined, true, payloadExtras );
            return await this.finalizeSession( session );
        } catch( e ) {
            if ( this.handleAuthenticationFailure( e ) ) {
                return this.state.result;
            }
        }

        this.state.result = AlAuthenticationResult.InvalidCredentials;
        return this.state.result;
    }

    /**
     * Authenticate against AIMS using a fortra IdP-provided access token.
     */
    public async authenticateFromFortraSession( fortraSession:FortraSession ):Promise<AlAuthenticationResult> {
        /*
         * This doesn't exist yet, and may never need to
         */
        try {
            let session = await this.authenticateViaAIMSFromFortra( fortraSession );
            return await this.finalizeSession( session );
        } catch( e ) {
            if ( this.handleAuthenticationFailure( e ) ) {
                return this.state.result;
            }
        }

        this.state.result = AlAuthenticationResult.InvalidCredentials;

        return this.state.result;
    }

    /**
     * Performs authentication using a session token (which must be separately populated into `this.state.sessionToken`) and
     * an MFA verification code.
     */
    public async validateMfaCode( verificationCode:string ):Promise<AlAuthenticationResult> {
        let useGestalt = ! AlRuntimeConfiguration.options.noGestaltAuthentication;
        if ( useGestalt ) {
            try {
                let session = await AlDefaultClient.authenticateWithMFAViaGestalt( this.getSessionToken(), verificationCode );
                return await this.finalizeSession( session );
            } catch ( e ) {
                if ( this.handleAuthenticationFailure( e ) ) {
                    return this.state.result;
                }
            }
        }

        try {
            let session = await AlDefaultClient.authenticateWithMFASessionToken( this.getSessionToken(), verificationCode, true );
            return await this.finalizeSession( session );
        } catch( e ) {
            if ( this.handleAuthenticationFailure( e ) ) {
                return this.state.result;
            }
        }
        this.state.result = AlAuthenticationResult.InvalidCredentials;
        return this.state.result;
    }

    /**
     * Performs authentication using a session token (which must be separately populated into `this.state.sessionToken`).
     */
    public async acceptTermsOfService(acceptTOS:boolean = true):Promise<AlAuthenticationResult> {
        let useGestalt = ! AlRuntimeConfiguration.options.noGestaltAuthentication;
        if ( useGestalt ) {
            try {
                let session = await AlDefaultClient.acceptTermsOfServiceViaGestalt( this.getSessionToken(), acceptTOS );
                return await this.finalizeSession( session );
            } catch ( e ) {
                if ( this.handleAuthenticationFailure( e ) ) {
                    return this.state.result;
                }
            }
        }

        try {
            let session = await AlDefaultClient.acceptTermsOfService( this.getSessionToken(), true, acceptTOS );
            return await this.finalizeSession( session );
        } catch( e ) {
            if ( this.handleAuthenticationFailure( e ) ) {
                return this.state.result;
            }
        }
        return this.state.result;
    }

    /**
     * Updates the user's TOS status when a session is already established.
     */
    public async updateTermsOfServiceAcceptance( accountId:string, acceptTOS:boolean = true ):Promise<void> {
        return await AIMSClient.setLicenseAcceptance( accountId, acceptTOS );
    }

    /**
     * Retrieves the last authentication result, if any; defaults to `AlAuthenticationResult.Unauthenticated`.
     */
    public getResult():AlAuthenticationResult {
        return this.state.result || AlAuthenticationResult.Unauthenticated;
    }

    /**
     * Retrieves the session token provided in response to the last authentication attempt, if any.
     */
    public getSessionToken():string {
        if ( ! this.state.sessionToken ) {
            throw new Error("Invalid usage: no session token is available." );
        }
        return this.state.sessionToken;
    }

    /**
     * Retrieves the TOS URL provided in response to the last authentication attempt, if any.
     */
    public getTermsOfServiceURL():string {
        if ( ! this.state.termsOfServiceURL ) {
            throw new Error("Invalid usage: no terms of service URL is available." );
        }
        return this.state.termsOfServiceURL;
    }

    /**
     * Retrieves the TOS Deadline provided in response to the last authentication attempt, if any.
     */
    public getDeferralTOSPeriodEnd():string {
        if ( ! this.state.deferralTOSPeriodEnd ) {
            throw new Error("Invalid usage: no deferral TOS period end is available." );
        }
        return this.state.deferralTOSPeriodEnd;
    }

    /**
     * "Normalizes" a return URL -- internally, this merely checks the URL against a whitelist of target domains.
     */
    public filterReturnURL( returnURL:string, defaultReturnURL?:string ):string {
        let validPatterns = [
            /https?:\/\/[\w\-\.]*alertlogic\.(net|com|co\.uk).*/,
            /https?:\/\/localhost:.*/
        ];
        if ( validPatterns.find( pattern => pattern.test( returnURL ) ) ) {
            return returnURL;
        }
        return defaultReturnURL || AlLocatorService.resolveURL( AlLocation.AccountsUI, `/#/` );
    }

    /**
     * Fortra-Derived Authentication - use a fortra identity to authenticate against AIMS
     */

    public async authenticateViaAIMSFromFortra( fortraSession:FortraSession ):Promise<AIMSSessionDescriptor> {
        let tokenInfo = await AlDefaultClient.get( {
            service_stack: AlLocation.GlobalAPI,
            service_name: "aims",
            version: 1,
            path: `/token_info`,
            headers: { Authorization: `Bearer ${fortraSession.accessToken}` },
            aimsAuthHeader: false
        } ) as AIMSAuthentication;
        tokenInfo.token = fortraSession.accessToken;                    //  token_info endpoint doesn't include this property in its response
        let outcome:AIMSSessionDescriptor = {
            fortraSession,
            authentication: tokenInfo
        };
        return outcome;
    }

    public async convertFortraToken( fortraSession:FortraSession ):Promise<string> {
        let reqDescr:APIRequestParams = {
            service_stack: AlLocation.GlobalAPI,
            service_name: "aims",
            version: 1,
            path: `/authenticate/convert_token`,
            aimsAuthHeader: false,
            headers: {}
        };
        if ( AlRuntimeConfiguration.options.embeddedFortraApp ) {
            reqDescr.withCredentials = true;    // let the cookie do its thing
            if ( AlLocatorService.getCurrentEnvironment() === 'embedded-development' ) {
                reqDescr.headers['X-Fortra-Environment'] = "dev";
            }
        } else {
            reqDescr.data = {                   //  explicitly provided
                token: fortraSession.accessToken
            };
        }
        let converted = await AlDefaultClient.post( reqDescr ) as AIMSAuthentication;
        return converted.token;
    }

    protected async authenticateViaGestaltFromFortra( fortraSession:FortraSession ):Promise<AIMSSessionDescriptor> {
        let outcome = await AlDefaultClient.post( {
            service_stack: AlLocation.MagmaUI,
            version: 1,
            path: "session/v1/authenticate",
            data: { authorization: `Bearer ${fortraSession.accessToken}` },
        } ) as AIMSSessionDescriptor;
        outcome.fortraSession = fortraSession;
        return outcome;
    }

    /**
     * Given a session descriptor, persists that session to AlSession and conduit and then sets the authentication
     * result to `Authenticated`.
     */
    protected async finalizeSession( session:AIMSSessionDescriptor ) {
        try {
            await AlSession.setAuthentication( session );
            await this.conduit.setSession( session );
            this.state.result = AlAuthenticationResult.Authenticated;
            return this.getResult();
        } catch( e ) {
            console.error(`Failed to authenticate`, e );
            throw e;
        }
    }

    protected handleAuthenticationFailure( error:Error|any ):boolean {

        if ( AlDefaultClient.isResponse( error ) ) {
            if ( this.requiresMfaCode( error ) ) {
                this.state.result = AlAuthenticationResult.MFAVerificationRequired;
                this.state.sessionToken = error.headers['x-aims-session-token'];
                return true;
            } else if ( this.requiresMfaEnrollment( error ) ) {
                this.state.result = AlAuthenticationResult.MFAEnrollmentRequired;
                this.state.sessionToken = error.headers['x-aims-session-token'];
                return true;
            } else if ( this.requiresPasswordReset( error ) ) {
                this.state.result = AlAuthenticationResult.PasswordResetRequired;
                return true;
            } else if ( this.requiresTOSAcceptance( error ) ) {
                this.state.result = AlAuthenticationResult.TOSAcceptanceRequired;
                this.state.termsOfServiceURL = getJsonPath<string>( error, 'data.tos_url', null );
                this.state.sessionToken = error.headers['x-aims-session-token'];
                return true;
            } else if ( this.requiresTOSReacceptance( error ) ) {
                this.state.result = AlAuthenticationResult.TOSReacceptanceRequired;
                this.state.termsOfServiceURL = getJsonPath<string>( error, 'data.tos_url', null );
                this.state.sessionToken = error.headers['x-aims-session-token'];
                this.state.deferralTOSPeriodEnd = getJsonPath<string>( error, 'data.tos_deferral_period_end', null );
                return true;
            } else if ( this.requiresFortraIdP( error ) ) {
                this.state.result = AlAuthenticationResult.FortraIdPRequired;
                return true;
            } else if( error.status === 400) {
                this.state.result = AlAuthenticationResult.AccountLocked;
                return true;
            } else if ( error.status === 401 ) {
                this.state.result = AlAuthenticationResult.InvalidCredentials;
                return true;
            } else if ( error.status === 403 ) {
                this.state.result = AlAuthenticationResult.AccountUnavailable;
                return true;
            }
            /**
             * All non-400/401 errors, include 5xx, fall through and return false
             */
        }
        return false;
    }

    protected requiresMfaCode( response:AxiosResponse<any> ):boolean {
        return response.status === 401
            && typeof( response.data ) === 'object'
            && response.data !== null
            && 'error' in response.data
            && response.data.error === 'mfa_code_required';
    }

    protected requiresMfaEnrollment( response:AxiosResponse<any> ):boolean {
        return response.status === 401
            && typeof( response.data ) === 'object'
            && response.data !== null
            && 'error' in response.data
            && response.data.error === 'mfa_enrollment_required';
    }

    protected requiresPasswordReset( response:AxiosResponse<any> ):boolean {
        return response.status === 400
            && typeof( response.data ) === 'object'
            && response.data !== null
            && 'error' in response.data
            && response.data.error === 'password_expired';
    }

    protected requiresTOSAcceptance( response:AxiosResponse<any> ):boolean {
        return response.status === 401
            && typeof( response.data ) === 'object'
            && response.data !== null
            && 'error' in response.data
            && response.data.error === 'accept_tos_required';
    }

    protected requiresTOSReacceptance( response:AxiosResponse<any> ):boolean {
        return response.status === 401
            && typeof( response.data ) === 'object'
            && response.data !== null
            && 'error' in response.data
            && response.data.error === 'reaccept_tos_required';
    }

    protected requiresFortraIdP( response:AxiosResponse<any> ):boolean {
        return response.status === 401
            && typeof( response.data ) === 'object'
            && response.data !== null
            && 'error' in response.data
            && response.data.error === 'fortra_required';
    }

}
