/**
 * Module to deal with available AIMS Public API endpoints
 */

import { AlRuntimeConfiguration } from '../configuration';
import {
    AlApiClient,
    AlDefaultClient,
    APIRequestParams,
} from "../client";
import {
    AlLocation,
    AlLocatorService,
} from "../navigation";
import {
    AIMSAccessKey,
    AIMSAccount,
    AIMSAuthenticationTokenInfo,
    AIMSOrganization,
    AIMSRole,
    AIMSSessionDescriptor,
    AIMSTopology,
    AIMSUser,
    AIMSUserDetails,
    AIMSEnrollURI,
    AIMSLicenseAcceptanceStatus,
    AIMSMappedAccount,
} from './types';

export class AIMSClientInstance {

  private client:AlApiClient;
  private serviceName = 'aims';
  private serviceVersion:string = "v1";
  /* tslint:disable:variable-name*/
  private _usersDict = {};
  public get usersDict() {
    return this._usersDict;
  }

  constructor( client:AlApiClient = null ) {
    this.client = client || AlDefaultClient;
  }

  /**
   * Create a user
   * POST
   * /aims/v1/:account_id/users?one_time_password=:one_time_password
   * "https://api.cloudinsight.alertlogic.com/aims/v1/12345678/users"
   * -d '{ "name": "Bob Dobalina", "email": "admin@company.com", "mobile_phone": "123-555-0123" }'
   */
  async createUser(accountId: string, name: string, email: string, mobilePhone: string) {
    const user = await this.client.post({
      service_stack: AlLocation.GlobalAPI,
      service_name: this.serviceName,
      version: this.serviceVersion,
      account_id: accountId,
      path: '/users',
      data: { name, email, mobile_phone: mobilePhone }
    });
    return user as AIMSUser;
  }

  /**
   * Create a user with details
   * POST
   * /aims/v1/:account_id/users
   * "https://api.cloudinsight.alertlogic.com/aims/v1/12345678/users"
   * -d '{ "name": "Bob Dobalina", "email": "admin@company.com", "phone": "12321312", "mobile_phone": "123-555-0123" }'
   */
  async createUserWithDetails(accountId: string, userDetails:AIMSUserDetails) {
    return this.client.post<AIMSUser>({
      service_stack: AlLocation.GlobalAPI,
      service_name: this.serviceName,
      version: this.serviceVersion,
      account_id: accountId,
      path: '/users',
      data: userDetails
    });
  }

  /**
   * Update user details
   * POST
   * /aims/v1/:account_id/users/:user_id
   * -d '{"name": "Bob Odenkirk", "email": "bodenkirk@company.com", "mobile_phone": "123-555-0124"}' "https://api.product.dev.alertlogic.com/aims/v1/12345678/users/715A4EC0-9833-4D6E-9C03-A537E3F98D23"
   */
  async updateUserDetails(accountId: string, userId: string, data:AIMSUserDetails):Promise<AIMSUser> {
    const userDetailsUpdate = await this.client.post({
      service_stack: AlLocation.GlobalAPI,
      service_name: this.serviceName,
      version: this.serviceVersion,
      account_id: accountId,
      path: `/users/${userId}`,
      data: data
    });
    return userDetailsUpdate;
  }

  /**
   * Delete a user
   * DELETE
   * /aims/v1/:account_id/users/:user_id
   * "https://api.cloudinsight.alertlogic.com/aims/v1/12345678/users/715A4EC0-9833-4D6E-9C03-A537E3F98D23"
   */
  async deleteUser(accountId: string, userId: string) {
    const userDelete = await this.client.delete({
      service_stack: AlLocation.GlobalAPI,
      service_name: this.serviceName,
      version: this.serviceVersion,
      account_id: accountId,
      path: `/users/${userId}`,
    });
    return userDelete;
  }

  async recordSessionStart( accountId: string, userId: string ) {
      return await this.client.post( {
          service_stack: AlLocation.GlobalAPI,
          service_name: this.serviceName,
          version: this.serviceVersion,
          account_id: accountId,
          path: `/users/${userId}/new_session`,
          data: {}
      } );
  }

  /**
   * Get user details
   * GET
   * /aims/v1/:account_id/users/:user_id
   * "https://api.cloudinsight.alertlogic.com/aims/v1/12345678/users/715A4EC0-9833-4D6E-9C03-A537E3F98D23"
   */
  async getUserDetailsById(accountId: string, userId: string) {
    const userDetails = await this.client.get({
      service_stack: AlLocation.GlobalAPI,
      service_name: this.serviceName,
      version: this.serviceVersion,
      account_id: accountId,
      path: `/users/${userId}`,
      ttl: 2 * 60 * 1000
    });
    return userDetails as AIMSUser;
  }

  async getUserDetailsByUserId(userId: string) {
    const userDetails = await this.client.get({
      service_stack: AlLocation.GlobalAPI,
      service_name: this.serviceName,
      version: this.serviceVersion,
      path: `/user/${userId}`
    });
    return userDetails as AIMSUser;
  }

  /**
     * Asynchronously loads user names for a list of user IDs.
     * Updates the user dictionary with the user's name or sets it to "Unknown User" in case of an error.
     * @param {string[]} userIds - Array of user IDs to load details for.
     * @returns {Promise<void>} A promise that resolves once all user details are loaded.
     */
  async loadUserNames(userIds: string[]): Promise<void> {
      let promises: Promise<AIMSUser>[] = [];
      userIds.forEach((id) => {
        if (!(id in this._usersDict)) {
          promises.push(AIMSClient.getUserDetailsByUserId(id));
        }
      });
      let results = await Promise.allSettled(promises);
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          this._usersDict[result.value.id] = result.value.name ?? '';
        }
      });
  }

  /**
   * Get user permissions
   * GET
   * /aims/v1/:account_id/users/:user_id/permissions
   * "https://api.cloudinsight.alertlogic.com/aims/v1/12345678/users/715A4EC0-9833-4D6E-9C03-A537E3F98D23/permissions"
   */
  async getUserPermissions(accountId: string, userId: string) {
    const userPermissions = await this.client.get({
      service_stack: AlLocation.GlobalAPI,
      service_name: this.serviceName,
      version: this.serviceVersion,
      account_id: accountId,
      path: `/users/${userId}/permissions`,
      ttl: 2 * 60 * 1000
    });
    return userPermissions;
  }

  /**
   * Get Account Details
   * GET
   * /aims/v1/:account_id/account
   * "https://api.cloudinsight.alertlogic.com/aims/v1/12345678/account"
   */
  async getAccountDetails(accountId: string) {
    const accountDetails = await this.client.get({
      service_stack: AlLocation.GlobalAPI,
      service_name: this.serviceName,
      version: this.serviceVersion,
      account_id: accountId,
      path: '/account',
      ttl: 2 * 60 * 1000
    });
    return accountDetails as AIMSAccount;
  }

  /**
   * @deprecated use getAccountsByRelationship
   * List managed accounts
   * GET
   * /aims/v1/:account_id/accounts/:relationship
   * "https://api.cloudinsight.alertlogic.com/aims/v1/12345678/accounts/managed"
   */
  async getManagedAccounts(accountId: string, queryParams?):Promise<AIMSAccount[]> {
    return this.getAccountsByRelationship(accountId, 'managed', queryParams );
  }

  /**
   * @deprecated use getAccountIdsByRelationship
   * List managed account IDs
   * GET
   * /aims/v1/:account_id/account_ids/:relationship
   * "https://api.cloudinsight.alertlogic.com/aims/v1/12345678/account_ids/managed"
   */
  async getManagedAccountIds(accountId: string, queryParams?):Promise<string[]> {
    return this.getAccountIdsByRelationship(accountId, 'managed', queryParams );
  }

  /**
   * List account IDs, by relationship can be managing, managed and bills_to
   * GET
   * /aims/v1/:account_id/account_ids/:relationship
   * "https://api.cloudinsight.alertlogic.com/aims/v1/12345678/account_ids/managing"
   * "https://api.cloudinsight.alertlogic.com/aims/v1/12345678/account_ids/managed"
   * "https://api.cloudinsight.alertlogic.com/aims/v1/12345678/account_ids/bills_to"
   */
  async getAccountIdsByRelationship(accountId: string, relationship: string, queryParams?):Promise<string[]> {
    const accountIds = await this.client.get({
      service_stack: AlLocation.GlobalAPI,
      service_name: this.serviceName,
      version: this.serviceVersion,
      account_id: accountId,
      path: `/account_ids/${relationship}`,
      params: queryParams,
      ttl: 2 * 60 * 1000
    });
    return accountIds.account_ids as string[];
  }

  /**
   * List accounts, by relationship can be managing, managed and bills_to
   * GET
   * /aims/v1/:account_id/accounts/:relationship
   * "https://api.cloudinsight.alertlogic.com/aims/v1/12345678/accounts/managing"
   * "https://api.cloudinsight.alertlogic.com/aims/v1/12345678/accounts/managed"
   * "https://api.cloudinsight.alertlogic.com/aims/v1/12345678/accounts/bills_to"
   */
  async getAccountsByRelationship(accountId: string, relationship: string, queryParams?):Promise<AIMSAccount[]> {
    const managedAccounts = await this.client.get({
      service_stack: AlLocation.GlobalAPI,
      service_name: this.serviceName,
      version: this.serviceVersion,
      account_id: accountId,
      path: `/accounts/${relationship}`,
      params: queryParams,
      ttl: 2 * 60 * 1000
    });
    return managedAccounts.accounts as AIMSAccount[];
  }

  /**
   *  Retrieve a union of user records corresponding to a managed relationship hierarchy between two accounts.
   *  This is a placeholder for a better implementation based on a relationship topology endpoint from AIMS.0
   *  @deprecated use getAccountsIdsByRelationship in conjunction with getUsersFromAccounts
   */
  async getUsersFromManagedRelationship( leafAccountId:string, terminalAccountId?:string, failOnError:boolean = true ):Promise<AIMSUser[]> {
    let users = await this.getUsers( leafAccountId, { include_role_ids: false, include_user_credential: false } );
    try {
      let managing = await this.getAccountsByRelationship( leafAccountId, "managing" );
      if ( managing.length > 0 ) {
        managing.sort( ( a, b ) => parseInt( b.id, 10 ) - parseInt( a.id, 10 ) );               //  this is gross hackery.  Kevin did not implement this.  Tell no-one of what you've seen!
        let parentUsers = await this.getUsersFromManagedRelationship( managing[0].id, terminalAccountId );
        if ( Array.isArray( parentUsers ) ) {
          users = users.concat( parentUsers );
        }
      }
    } catch( e ) {
      if ( failOnError ) {
        throw e;
      }
    }
    return users;
  }

  /**
   * Update account MFA requirements
   * POST
   * /aims/v1/:account_id/account
   * -d '{"mfa_required": true}' "https://api.cloudinsight.alertlogic.com/aims/v1/12345678/account"
   */
  async requireMFA(accountId: string, mfaRequired: boolean):Promise<AIMSAccount> {
    const account = await this.client.post({
      service_stack: AlLocation.GlobalAPI,
      service_name: this.serviceName,
      version: this.serviceVersion,
      account_id: accountId,
      path: '/account',
      data: { mfa_required: mfaRequired }
    });
    return account as AIMSAccount;
  }

  /**
   * Update account session idle expiration
   * POST
   * This updates a single property of an AIMS account record, affecting how long users of that account
   * can be idle before their sessions will be terminated due to inactivity.
   */
  async setAccountIdleThreshold( accountId:string, seconds:number|null ) {
    await this.client.post( {
      service_stack: AlLocation.GlobalAPI,
      service_name: this.serviceName,
      version: this.serviceVersion,
      account_id: accountId,
      path: '/account',
      data: {
        idle_session_timeout: seconds
      }
    } );
  }

  /**
   * Authenticate a user's identity
   * POST
   * /aims/v1/authenticate
   * -u username:password "https://api.cloudinsight.alertlogic.com/aims/v1/authenticate"
   */
  async authenticate( user:string, pass:string, mfa?:string ): Promise<AIMSSessionDescriptor> {
    return this.client.authenticate( user, pass, mfa, true );
  }

  /**
   * Authenticate a user's identity with an mfa code and session token
   */
  async authenticateWithMFASessionToken(token: string, mfa: string): Promise<AIMSSessionDescriptor> {
    return this.client.authenticateWithMFASessionToken(token, mfa, true );
  }

  /**
   * Change a user's password
   * POST
   * /aims/v1/change_password
   * -d '{"email": "admin@company.com", "current_password": "hunter2", "new_password": "Fraudulent$Foes"}' "https://api.cloudinsight.alertlogic.com/aims/v1/change_password"
   */
  async changePassword(email: string, password: string, newPassword: string) {
    const changePass = await this.client.post({
      service_stack: AlLocation.GlobalAPI,
      service_name: this.serviceName,
      version: this.serviceVersion,
      path: '/change_password',
      data: { email, current_password: password, new_password: newPassword }
    });
    return changePass;
  }

  /**
   * Obtain Authentication Token Information (Account, User, Roles, etc.)
   *
   * @deprecated
   *
   * GET
   * /aims/v1/token_info
   * "https://api.cloudinsight.alertlogic.com/aims/v1/token_info"
   */
  async tokenInfo() {
    const tokenData = await this.client.get({
      service_stack: AlLocation.GlobalAPI,
      service_name: this.serviceName,
      version: this.serviceVersion,
      path: '/token_info',
    });
    return tokenData as AIMSAuthenticationTokenInfo;
  }

  /**
   * Obtain Authentication Token Information for a specific access token
   */
  public async getTokenInfo( accessToken:string, useAuthenticationHeader:boolean = false ):Promise<AIMSAuthenticationTokenInfo> {
    let request:APIRequestParams = {
      service_stack: AlLocation.GlobalAPI,
      service_name: this.serviceName,
      version: 1,
      path: '/token_info',
      headers: {},
      ttl: 10 * 60 * 1000,
      cacheKey: AlLocatorService.resolveURL( AlLocation.GlobalAPI, `/aims/v1/token_info/${accessToken}` )       //  custom cacheKey to avoid cache pollution
    };

    if ( AlLocatorService.getCurrentEnvironment() === 'embedded-development' ) {
      request.headers['X-Fortra-Environment'] = "dev";  // This allows integration AIMS to service both development and integration environments
    }
    if ( AlRuntimeConfiguration.options.embeddedFortraApp ) {
        /* This allows the fortra-platform-at and other cookies to be used in the request */
        request.withCredentials = true;
    } else {
        if ( useAuthenticationHeader ) {
          request.headers['Authorization'] = `Bearer ${accessToken}`;
        } else {
          request.headers['X-AIMS-Auth-Token'] = accessToken;
        }
    }
    return await this.client.get( request );
  }

  /**
   * Initiate the password reset process for a user
   * POST
   * /aims/v1/reset_password
   * -d '{"email": "admin@company.com", "return_to": "https://console.alertlogic.net"}' "https://api.cloudinsight.alertlogic.com/aims/v1/reset_password"
   */
  async initiateReset(email: string, returnTo: string) {
    const reset = await this.client.post({
      service_stack: AlLocation.GlobalAPI,
      service_name: this.serviceName,
      version: this.serviceVersion,
      path: '/reset_password',
      data: { email, return_to: returnTo },
    });
    return reset;
  }

  /**
   * Reset a user's password using a token
   * PUT
   * /aims/v1/reset_password/:token
   * -d '{"password": "hunter2"}' "https://api.cloudinsight.alertlogic.com/aims/v1/reset_password/69EtspCz3c4"
   */
  async resetWithToken(token: string, password: string) {
    const reset = await this.client.put({
      service_stack: AlLocation.GlobalAPI,
      service_name: this.serviceName,
      version: this.serviceVersion,
      path: `/reset_password/${token}`,
      data: { password },
    });
    return reset;
  }

  /**
   * Create a role
   * POST
   * /aims/v1/:account_id/roles
   * -d '{"name": "Super Mega Power User", "permissions": {"*:own:*:*": "allowed", "aims:own:grant:*":"allowed"}}' "https://api.cloudinsight.alertlogic.com/aims/v1/12345678/roles"
   */
  async createRole(accountId: string, name: string, permissions) {
    const createRole = await this.client.post({
      service_stack: AlLocation.GlobalAPI,
      service_name: this.serviceName,
      version: this.serviceVersion,
      account_id: accountId,
      path: '/roles',
      data: { name, permissions }
    });
    return createRole as AIMSRole;
  }

  /**
   * Delete a role
   * DELETE
   * /aims/v1/:account_id/roles/:role_id
   * "https://api.cloudinsight.alertlogic.com/aims/v1/12345678/roles/C7C5BE57-F199-4F14-BCB5-43E31CA02842"
   */
  async deleteRole(accountId: string, roleId: string) {
    const roleDelete = await this.client.delete({
      service_stack: AlLocation.GlobalAPI,
      service_name: this.serviceName,
      version: this.serviceVersion,
      account_id: accountId,
      path: `/roles/${roleId}`
    });
    return roleDelete;
  }

  /**
   * Grant a role
   * PUT
   * /aims/v1/:account_id/users/:user_id/roles/:role_id
   * "https://api.product.dev.alertlogic.com/aims/v1/12345678/users/715A4EC0-9833-4D6E-9C03-A537E3F98D23/roles/2A33175D-86EF-44B5-AA39-C9549F6306DF"
   */
  async grantRole(accountId:string, userId:string, roleId:string) {
    return this.client.put({
      service_stack: AlLocation.GlobalAPI,
      service_name: this.serviceName,
      version: this.serviceVersion,
      account_id: accountId,
      path: `/users/${userId}/roles/${roleId}`
    });
  }

  /**
   * Revoke a role
   * DELETE
   * /aims/v1/:account_id/users/:user_id/roles/:role_id
   * "https://api.product.dev.alertlogic.com/aims/v1/12345678/users/715A4EC0-9833-4D6E-9C03-A537E3F98D23/roles/2A33175D-86EF-44B5-AA39-C9549F6306DF"
   */
  async revokeRole(accountId:string, userId:string, roleId:string) {
    return this.client.delete({
      service_stack: AlLocation.GlobalAPI,
      service_name: this.serviceName,
      version: this.serviceVersion,
      account_id: accountId,
      path: `/users/${userId}/roles/${roleId}`
    });
  }

  /**
   * Get global role, a role that is shared among accounts.
   * GET
   * /aims/v1/roles/:role_id
   * "https://api.cloudinsight.alertlogic.com/aims/v1/roles/2A33175D-86EF-44B5-AA39-C9549F6306DF"
   */
  async getGlobalRole(roleId: string) {
    const role = await this.client.get({
      service_stack: AlLocation.GlobalAPI,
      service_name: this.serviceName,
      version: this.serviceVersion,
      path: `/roles/${roleId}`
    });
    return role as AIMSRole;
  }

  /**
   * Get role
   * GET
   * /aims/v1/:account_id/roles/:role_id
   * "https://api.cloudinsight.alertlogic.com/aims/v1/12345678/roles/2A33175D-86EF-44B5-AA39-C9549F6306DF"
   */
  async getAccountRole(accountId: string, roleId: string) {
    const role = await this.client.get({
      service_stack: AlLocation.GlobalAPI,
      service_name: this.serviceName,
      version: this.serviceVersion,
      account_id: accountId,
      path: `/roles/${roleId}`
    });
    return role as AIMSRole;
  }

  /**
   * Get assigned roles
   * GET
   * /aims/v1/:account_id/users/:user_id/roles
   * "https://api.cloudinsight.alertlogic.com/aims/v1/12345678/users/715A4EC0-9833-4D6E-9C03-A537E3F98D23/roles"
   */
  async getAssignedRoles( accountId:string, userId:string ):Promise<AIMSRole[]> {
    const roles = await this.client.get({
      service_stack: AlLocation.GlobalAPI,
      service_name: this.serviceName,
      version: this.serviceVersion,
      account_id: accountId,
      path: `/users/${userId}/roles`
    });
    return roles.roles;
  }

  /**
   * List global roles, roles that are shared among all accounts.
   * GET
   * /aims/v1/roles
   * "https://api.cloudinsight.alertlogic.com/aims/v1/roles"
   */
  async getGlobalRoles():Promise<AIMSRole[]> {
    const roles = await this.client.get({
      service_stack: AlLocation.GlobalAPI,
      service_name: this.serviceName,
      version: this.serviceVersion,
      path: '/roles'
    });
    return roles.roles;
  }

  /**
   * List roles for an account. Global roles are included in the list.
   * GET
   * /aims/v1/:account_id/roles
   * "https://api.cloudinsight.alertlogic.com/aims/v1/12345678/roles"
   */
  async getAccountRoles(accountId: string):Promise<AIMSRole[]> {
    const roles = await this.client.get({
      service_stack: AlLocation.GlobalAPI,
      service_name: this.serviceName,
      version: this.serviceVersion,
      account_id: accountId,
      path: '/roles'
    });
    return roles.roles as AIMSRole[];
  }

  /**
   * Update Role Name and Permissions
   * POST
   * /aims/v1/:account_id/roles/:role_id
   * -d '{"name": "Mega Power User", "permissions": {"*:own:*:*": "allowed", "aims:own:grant:*":"allowed"}}' "https://api.cloudinsight.alertlogic.com/aims/v1/12345678/roles/2A33175D-86EF-44B5-AA39-C9549F6306DF"
   */
  async updateRole(accountId: string, name: string, permissions) {
    const roleUpdate = await this.client.post({
      service_stack: AlLocation.GlobalAPI,
      service_name: this.serviceName,
      version: this.serviceVersion,
      account_id: accountId,
      path: '/roles',
      data: { name, permissions }
    });
    return roleUpdate;
  }
  /**
   * Update Role Name
   * POST
   * /aims/v1/:account_id/roles/:role_id
   * -d '{"name": "Mega Power User"}' "https://api.cloudinsight.alertlogic.com/aims/v1/12345678/roles/2A33175D-86EF-44B5-AA39-C9549F6306DF"
   */
  async updateRoleName(accountId: string, name: string) {
    const updateRole = await this.client.post({
      service_stack: AlLocation.GlobalAPI,
      service_name: this.serviceName,
      version: this.serviceVersion,
      account_id: accountId,
      path: '/roles',
      data: { name }
    });
    return updateRole as AIMSRole;
  }
  /**
   * Update Role Permissions
   * POST
   * /aims/v1/:account_id/roles/:role_id
   * -d '{"permissions": {"*:own:*:*": "allowed", "aims:own:grant:*":"allowed"}}' "https://api.cloudinsight.alertlogic.com/aims/v1/12345678/roles/2A33175D-86EF-44B5-AA39-C9549F6306DF"
   */
  async updateRolePermissions(accountId: string, permissions) {
    const updateRole = await this.client.post({
      service_stack: AlLocation.GlobalAPI,
      service_name: this.serviceName,
      version: this.serviceVersion,
      account_id: accountId,
      path: '/roles',
      data: { permissions }
    });
    return updateRole as AIMSRole as AIMSRole;
  }

  /**
   * Enroll an MFA device for a user
   * POST
   * /aims/v1/user/mfa/enroll
   *  "https://api.cloudinsight.alertlogic.com/aims/v1/user/mfa/enroll" \
   * -H "Content-Type: application/json" \
   * -H "X-Aims-Session-Token: a3e12fwafge1g9" \
   * -d @- << EOF
   * {
   *    "mfa_uri": "otpauth://totp/Alert%20Logic:admin@company.com?secret=GFZSA5CINFJSA4ZTNNZDG5BAKM2EMMZ7&issuer=Alert%20Logic&algorithm=SHA1"
   *    "mfa_codes": ["123456", "456789"]
   * }
   * EOF
   */
  async enrollMFA( uri: string, sessionToken:string, codes:string[] ) {
    const mfa = await this.client.post({
      service_stack: AlLocation.GlobalAPI,
      service_name: this.serviceName,
      version: this.serviceVersion,
      path: '/user/mfa/enroll',
      noEndpointsResolution: true,
      data: { mfa_uri: uri, mfa_codes: codes },
      headers: {
          'X-AIMS-Session-Token': sessionToken
      }
    });
    return mfa;
  }

  /**
   * Enroll an MFA device for a user (when no AIMS token available).
   * POST
   * /aims/v1/user/mfa/enroll
   *  "https://api.cloudinsight.alertlogic.com/aims/v1/user/mfa/enroll" \
   * -H "Content-Type: application/json" \
   * -d @- << EOF
   * {
   *    "mfa_uri": "otpauth://totp/Alert%20Logic:admin@company.com?secret=GFZSA5CINFJSA4ZTNNZDG5BAKM2EMMZ7&issuer=Alert%20Logic&algorithm=SHA1"
   *    "mfa_codes": ["123456", "456789"],
   *    "password" : "password",
   *    "email" : "user@email.com"
   * }
   * EOF
   */
  async enrollMFAWithoutAIMSToken(uri:AIMSEnrollURI, codes:string[], email:string, password:string ) {
    return this.client.post({
      service_stack: AlLocation.GlobalAPI,
      service_name: this.serviceName,
      version: this.serviceVersion,
      path: '/user/mfa/enroll',
      noEndpointsResolution: true,
      data: {
        mfa_uri: uri.toString(),
        email: email,
        password: password,
        mfa_codes: codes
      }
    });
  }

  /**
   * Remove a user's MFA device
   * DELETE
   * /aims/v1/user/mfa/:email
   * "https://api.cloudinsight.alertlogic.com/aims/v1/user/mfa/admin@company.com"
   */
  async deleteMFA(email: string) {
    const mfa = await this.client.delete({
      service_stack: AlLocation.GlobalAPI,
      service_name: this.serviceName,
      version: this.serviceVersion,
      path: `/user/mfa/${email}`,
    });
    return mfa;
  }

  getUserDetails(accountId: string, userId: string, queryParams?: {include_role_ids?: boolean, include_user_credential?: boolean}): Promise<AIMSUser> {
    return this.client.get<AIMSUser>({
      service_stack: AlLocation.GlobalAPI,
      service_name: this.serviceName,
      version: this.serviceVersion,
      account_id: accountId,
      path: `/users/${userId}`,
      params: queryParams,
    });
  }

  /**
   * List Users
   * GET
   * /aims/v1/:account_id/users
   * "https://api.cloudinsight.alertlogic.com/aims/v1/12345678/users"
   */
  async getUsers( accountId: string,
                  queryParams?: {include_role_ids?: boolean, include_user_credential?: boolean} ):Promise<AIMSUser[]> {
    const users = await this.client.get({
      service_stack: AlLocation.GlobalAPI,
      service_name: this.serviceName,
      version: this.serviceVersion,
      account_id: accountId,
      path: '/users',
      params: queryParams,
    });
    return users.users as AIMSUser[];
  }

  /**
   * Create Access Key
   * POST
   * /aims/v1/:account_id/users/:user_id/access_keys
   * "https://api.cloudinsight.alertlogic.com/aims/v1/12345678/users/715A4EC0-9833-4D6E-9C03-A537E3F98D23/access_keys"
   * -d '{"label": "api access"}'
   */
  async createAccessKey(accountId: string, userId: string, label: string) {
    const key = await this.client.post({
      service_stack: AlLocation.GlobalAPI,
      service_name: this.serviceName,
      version: this.serviceVersion,
      account_id: accountId,
      path: `/users/${userId}/access_keys`,
      data: { label }
    });
    return key as AIMSAccessKey;
  }

  /**
   * Update Access Key
   * POST
   * /aims/v1/access_keys/:access_key_id
   * "https://api.cloudinsight.alertlogic.com/aims/v1/access_keys/61fb235617960503"
   * -d '{"label": "api access"}'
   */
  async updateAccessKey(accessKeyId: string, label: string) {
    const key = await this.client.post({
      service_stack: AlLocation.GlobalAPI,
      service_name: this.serviceName,
      version: this.serviceVersion,
      path: `/access_keys/${accessKeyId}`,
      data: { label }
    });
    return key as AIMSAccessKey;
  }

  /**
   * Get Access Key
   * GET
   * /aims/v1/access_keys/:access_key_id
   * "https://api.cloudinsight.alertlogic.com/aims/v1/access_keys/61fb235617960503"
   */
  async getAccessKey(accessKeyId: string) {
    const key = await this.client.get({
      service_stack: AlLocation.GlobalAPI,
      service_name: this.serviceName,
      version: this.serviceVersion,
      path: `/access_keys/${accessKeyId}`
    });
    return key as AIMSAccessKey;
  }

  /**
   * List Access Keys
   * GET
   * /aims/v1/:account_id/users/:user_id/access_keys?out=:out
   * https://api.cloudinsight.alertlogic.com/aims/v1/12345678/users/715A4EC0-9833-4D6E-9C03-A537E3F98D23/access_keys?out=full"
   */
  async getAccessKeys(accountId: string, userId: string, ttl: number = 60000) {
    const keys = await this.client.get({
      service_stack: AlLocation.GlobalAPI,
      service_name: this.serviceName,
      version: this.serviceVersion,
      account_id: accountId,
      ttl: ttl,
      path: `/users/${userId}/access_keys?out=full`
    });
    return keys.access_keys as AIMSAccessKey[];
  }

  /**
   * Delete Access Key
   * DELETE
   * /aims/v1/:account_id/users/:user_id/access_keys/:access_key_id
   * "https://api.cloudinsight.alertlogic.com/aims/v1/12345678/users/715A4EC0-9833-4D6E-9C03-A537E3F98D23/access_keys/61FB235617960503"
   */
  async deleteAccessKey(accountId: string, userId: string, accessKeyId: string) {
    const keyDelete = await this.client.delete({
      service_stack: AlLocation.GlobalAPI,
      service_name: this.serviceName,
      version: this.serviceVersion,
      account_id: accountId,
      path: `/users/${userId}/access_keys/${accessKeyId}`
    });
    return keyDelete;
  }

  /**
   * Retrieve linked organization
   */
  async getAccountOrganization( accountId:string ):Promise<AIMSOrganization> {
      const requestDescriptor = {
          service_stack: AlLocation.GlobalAPI,
          service_name: this.serviceName,
          version: 1,
          account_id: accountId,
          path: '/organization'
      };
      return await this.client.get( requestDescriptor ) as AIMSOrganization;
  }

  /**
   * Retrieves licensing status information for a given accountId.
   */
  async getLicenseAcceptanceStatus( accountId:string ):Promise<AIMSLicenseAcceptanceStatus> {
      return await this.client.get( {
          service_stack: AlLocation.GlobalAPI,
          service_name: this.serviceName,
          version: 1,
          account_id: accountId,
          path: '/tos_status'
      } );
  }

  /**
   * Updates license acceptance for a given accountId.
   */
  async setLicenseAcceptance( accountId:string, accepted:boolean ) {
      return await this.client.post( {
          service_stack: AlLocation.GlobalAPI,
          service_name: this.serviceName,
          version: 1,
          account_id: accountId,
          path: '/tos_status',
          data: {
              accept_tos: accepted
          }
      } );
  }

  /**
   * This endpoint render's an accounts related accounts topologically by adding a :relationship field to the account object,
   * which contains an array of accounts that are directly related to it.
   * GET
   * /aims/v1/:account_id/accounts/:relationship/topology
   * https://console.product.dev.alertlogic.com/api/aims/index.html#api-AIMS_Account_Resources-AccountRelationshipExists
   * @param accountId {string}
   * @param relationship {'managed' | 'managing'}
   * @param queryParms {Object}
   */
  async getAccountRelationshipTopology(accountId: string, relationship: 'managed' | 'managing', queryParams?): Promise<AIMSTopology> {
    const response = await this.client.get({
      service_stack: AlLocation.GlobalAPI,
      service_name: this.serviceName,
      version: this.serviceVersion,
      account_id: accountId,
      path: `/accounts/${relationship}/topology`,
      params: queryParams
    });
    return response.topology as AIMSTopology;
  }

  /**
   * Returns the ids of the accounts to which an account is related.
   * The related accounts that are returned depend oonf the :relationship param.
   * If using a "managed" relationship, this returns all accounts that the current account manages.
   * If using a "managing" relationship, this returns all accounts that managing the current account.
   * @param accountId {string}
   * @param relationship {'managed' | 'managing'}
   * @param addCurrentId {boolean} [addCurrentId=true] true if wants add the current id to the return
   */
  async getAccountsIdsByRelationship(accountId: string, relationship: 'managed' | 'managing', addCurrentId: boolean = true): Promise<string[]> {
    const topology = await this.getAccountRelationshipTopology(accountId, relationship);

    function getIds(accounts: AIMSTopology[]): string[] {
      return accounts.flatMap(a => [a.id, ...getIds(Array.isArray(a[relationship]) ? a[relationship] : [])]);
    }
    const first = addCurrentId ? [accountId] : [];
    return [...first, ...getIds(topology[relationship])];
  }

  /**
   * Retrieves the Frontline PCI scan migration status for a given account.  This is a placeholder for future functionality.
   */
  async getFrontlineMigrationStatus( accountId:string ):Promise<{import_status: "PENDING"|"RUNNING"|"COMPLETED"|"ERRORED",import_details:any}> {
      return await this.client.get( {
          service_stack: AlLocation.GlobalAPI,
          service_name: this.serviceName,
          version: this.serviceVersion,
          account_id: accountId,
          path: `/migrate/frontline/scans/status`
      } );
  }

  /**
   * Retrieves the mapped account given an account ID
   * @param accountId ALert Logic's account ID
   */
  async getMappedAccount(accountId: string): Promise<AIMSMappedAccount> {
    return await this.client.get({
      service_stack: AlLocation.GlobalAPI,
      service_name: this.serviceName,
      version: this.serviceVersion,
      path: `/${accountId}/mapping`
    });
  }

  /**
   * Triggers Frontline PCI scan migration for a given account.
   */
  async startFrontlineMigration( accountId:string ):Promise<boolean> {
      return await this.client.post( {
          service_stack: AlLocation.GlobalAPI,
          service_name: this.serviceName,
          version: this.serviceVersion,
          account_id: accountId,
          path: `/migrate/frontline/scans`
      } );
  }

  /**
   * Returns all users associated with a list of accounts
   * @param accountList {string[]}
   */
  async getUsersFromAccounts(accountList: string[]): Promise<AIMSUser[]> {
    return (await Promise.all(
      accountList.map(account => this.getUsers(account, { include_role_ids: false, include_user_credential: false }))
    )).flat();
  }

}

/* tslint:disable:variable-name */
export const AIMSClient = new AIMSClientInstance();
