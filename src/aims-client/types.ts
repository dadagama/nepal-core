import { AlChangeStamp } from '../types';

export interface AIMSMappedAccount {
    alertlogic_account: string;
    frontline_account: string;
    created: AlChangeStamp;
    modified: AlChangeStamp;
}

export interface AIMSAuthentication {
    user: AIMSUser;
    account: AIMSAccount;
    token: string;
    token_expiration: number;
}

export interface AIMSUser {
    account_id?: string;
    id?: string;
    name: string;
    email: string;
    active?: boolean;
    locked?: boolean;
    version?: number;
    created: AlChangeStamp;
    modified: AlChangeStamp;
    linked_users: any[];
}

export interface AIMSAccount {
    id?: string;
    name: string;
    active: boolean;
    version?: number;
    accessible_locations: string[];
    default_location: string;
    mfa_required?: boolean;
    federated_login_required?: boolean;
    fortra_authenticated?: boolean;
    fortra_required_after?: number;
    idle_session_timeout?: number;
    stateramp_required?: boolean;
    created: AlChangeStamp;
    modified: AlChangeStamp;
}

export interface FortraSession {
    identityToken:string;
    accessToken:string;
    refreshToken?:string;
}

export interface AIMSSessionDescriptor {
    authentication: AIMSAuthentication;
    acting?: AIMSAccount;
    boundLocationId?: string;
    profileId?:string;
    fortraSession?:FortraSession; /* for AIMS sessions created from fortra SSO sessions */
}

export interface AIMSAuthenticationTokenInfo extends AIMSAuthentication {
    entity_id?: string;
    entity_type?: string;
    requester_id?: string;
    roles?: AIMSRole[];
}

export interface AIMSUserDetails {
    name?:string;
    password?:string;
    email?:string;
    active?:boolean;
    mobile_phone?:string;
    phone?:string;
    webhook_url?:string;
    notifications_only?:boolean;
}

export class AIMSEnrollURI
{
    type:string = 'totp';
    issuer:string = "Alert Logic";
    algorithm:string = "SHA1";
    email:string;
    secret:string;

    constructor( email:string, secret:string ) {
        this.email = email;
        this.secret = secret;
    }

    public toString():string {
        return `otpauth://${this.type}/Alert%20Logic:${this.email}?secret=${encodeURIComponent(this.secret)}&issuer=${encodeURIComponent(this.issuer)}&algorithm=${this.algorithm}`;
    }
}

export interface AIMSRole {
    id: string;
    account_id: string;
    name: string;
    permissions: {
        [key: string]: string;
    };
    legacy_permissions: any[];
    version: number;
    global?: boolean;
    created?: AlChangeStamp;
    modified?: AlChangeStamp;
}

export interface AIMSAccessKey {
    access_key_id: string;
    user_id: string;
    account_id: string;
    label: string;
    last_login?:number;
    created?: AlChangeStamp;
    modified?: AlChangeStamp;
    secret_key?: string;
}

export interface AIMSOrganization {
    account_id: string;
    location_id: string;
    id: string;
    version: number;
    created: AlChangeStamp;
    modified: AlChangeStamp;
    url: string;
}

export interface AIMSTopology extends AIMSAccount {
    id: string;
    managing?: AIMSTopology[];
    managed?: AIMSTopology[];
}

export interface AIMSLicenseAcceptanceStatus {
    status: string;
    tos_url?: string;
    tos_deferral_period_end?: number;
}
