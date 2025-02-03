import { expect } from 'chai';

import { describe } from 'mocha';
import * as sinon from 'sinon';
import { AlDefaultClient } from "../../src/client";
import {
    AlLocation,
    AlLocatorService,
} from "../../src/navigation";
import {
    AIMSClient,
    AIMSClientInstance,
    AIMSEnrollURI
} from '../../src/aims-client';

const accountId = '12345';
const userId = '4567';
const queryParams = { foo: 'bar' };

describe('AIMS Client Test Suite:', () => {
  let stub: sinon.SinonSpy;
  let apiBaseURL, globalBaseURL;
  beforeEach(() => {
    AlLocatorService.setContext( { environment: "integration" } );
    AlDefaultClient.reset()
            .setGlobalParameters( { noEndpointsResolution: true } );
    stub = sinon.stub(AlDefaultClient as any, "axiosRequest").returns( Promise.resolve( { status: 200, data: 'Some result', config: {} } ) );
    apiBaseURL = AlLocatorService.resolveURL( AlLocation.InsightAPI );
    globalBaseURL = AlLocatorService.resolveURL( AlLocation.GlobalAPI );
  });
  afterEach(() => {
    stub.restore();
  });
  describe("when instantiating a client", () => {
    it("should capture the specified client", () => {
      let clientInstance = new AIMSClientInstance( AlDefaultClient );
      expect( clientInstance['client'] ).to.equal( AlDefaultClient );
    } );
  } );
  describe('when performing a create user operation', () => {
    it('should call post() on the AlDefaultClient instance with a correctly constructed payload', async() => {
      const name = 'someone.somewhere';
      const email = 'someone@somwehere.com';
      const mobilePhone = '123-456-789-000';
      await AIMSClient.createUser(accountId, name, email, mobilePhone);
      expect(stub.callCount).to.equal(1);
      const payload = stub.args[0][0];
      expect( payload.method ).to.equal( "POST" );
      expect( payload.url ).to.equal( `${apiBaseURL}/aims/v1/${accountId}/users` );
      expect( payload.data ).to.deep.equal( { name, email, mobile_phone: mobilePhone } );
    });
  });
  describe('when performing a delete user operation', () => {
    it('should call delete() on the AlDefaultClient instance with a correctly constructed payload', async() => {
      await AIMSClient.deleteUser(accountId, userId);
      expect(stub.callCount).to.equal(1);
      const payload = stub.args[0][0];
      expect( payload.method ).to.equal( "DELETE" );
      expect( payload.url ).to.equal( `${apiBaseURL}/aims/v1/${accountId}/users/${userId}` );
    });
  });
  describe('when retrieving a user record', () => {
    it('should call fetch() on the AlDefaultClient instance with a correctly constructed payload', async() => {
      await AIMSClient.getUserDetailsById(accountId, userId);
      expect(stub.callCount).to.equal(1);
      const payload = stub.args[0][0];
      expect( payload.method ).to.equal( "GET" );
      expect( payload.url ).to.equal( `${apiBaseURL}/aims/v1/${accountId}/users/${userId}` );
    });
  });
  describe('when retrieving permissions for a user', () => {
    it('should call fetch() on the AlDefaultClient instance with a correctly constructed payload', async() => {
      await AIMSClient.getUserPermissions(accountId, userId);
      expect(stub.callCount).to.equal(1);
      const payload = stub.args[0][0];
      expect( payload.method ).to.equal( "GET" );
      expect( payload.url ).to.equal( `${apiBaseURL}/aims/v1/${accountId}/users/${userId}/permissions` );
    });
  });
  describe('when retrieving account details', () => {
    it('should call fetch() on the AlDefaultClient instance with a correctly constructed payload', async() => {
      await AIMSClient.getAccountDetails(accountId);
      expect(stub.callCount).to.equal(1);
      const payload = stub.args[0][0];
      expect( payload.method ).to.equal( "GET" );
      expect( payload.url ).to.equal( `${apiBaseURL}/aims/v1/${accountId}/account` );
    });
  });
  describe('when retrieving managed account details', () => {
    it('should call fetch() on the AlDefaultClient instance with a correctly constructed payload', async() => {
      await AIMSClient.getManagedAccounts(accountId, queryParams);
      expect(stub.callCount).to.equal(1);
      const payload = stub.args[0][0];
      expect( payload.method ).to.equal( "GET" );
      expect( payload.url ).to.equal( `${apiBaseURL}/aims/v1/${accountId}/accounts/managed` );
    });
  });
  describe('when retrieving managed account Ids', () => {
    it('should call fetch() on the AlDefaultClient instance with a correctly constructed payload', async() => {
      await AIMSClient.getManagedAccountIds(accountId, queryParams);
      expect(stub.callCount).to.equal(1);
      const payload = stub.args[0][0];
      expect( payload.method ).to.equal( "GET" );
      expect( payload.url ).to.equal( `${apiBaseURL}/aims/v1/${accountId}/account_ids/managed` );
    });
  });
  describe('when retrieving managing account Id', () => {
    it('should call fetch() on the AlDefaultClient instance with a correctly constructed payload', async() => {
      await AIMSClient.getAccountIdsByRelationship(accountId,'managing', queryParams);
      expect(stub.callCount).to.equal(1);
      const payload = stub.args[0][0];
      expect( payload.method ).to.equal( "GET" );
      expect( payload.url ).to.equal( `${apiBaseURL}/aims/v1/${accountId}/account_ids/managing` );
    });
  });
  describe('when retrieving managing accounts', () => {
    it('should call fetch() on the AlDefaultClient instance with a correctly constructed payload', async() => {
      await AIMSClient.getAccountsByRelationship(accountId,'managing', queryParams);
      expect(stub.callCount).to.equal(1);
      const payload = stub.args[0][0];
      expect( payload.method ).to.equal( "GET" );
      expect( payload.url ).to.equal( `${apiBaseURL}/aims/v1/${accountId}/accounts/managing` );
    });
  });
  describe('when enabling MFA for a user account', () => {
    it('should call post() on the AlDefaultClient instance with a correctly constructed payload', async() => {
      await AIMSClient.requireMFA(accountId, true);
      expect(stub.callCount).to.equal(1);
      const payload = stub.args[0][0];
      expect( payload.method ).to.equal( "POST" );
      expect( payload.data ).to.deep.equal( { mfa_required: true } );
      expect( payload.url ).to.equal( `${apiBaseURL}/aims/v1/${accountId}/account` );
    });
  });
  describe('when authenticating a user', () => {
    it('should call authenticate() on the AlDefaultClient instance with the supplied params, username and password', async() => {
      const username = 'someone.somewhere';
      const password = 'LetMeIn!';
      await AIMSClient.authenticate(username, password, null );
      expect(stub.callCount).to.equal(1);
      const payload = stub.args[0][0];
      expect( payload.method ).to.equal( 'POST' );
      expect( payload.url ).to.equal( AlLocatorService.resolveURL( AlLocation.GlobalAPI, `/aims/v1/authenticate` ) );
    });
  });
  describe('when authenticating with an MFA session token', () => {
    it('should call authenticateWithMFASessionToken() on the AlDefaultClient instance with the supplied param, token and mfa values', async() => {
      const token = 'abc-123-xYz=-';
      const mfa = '123001';
      await AIMSClient.authenticateWithMFASessionToken(token, mfa );
      expect(stub.callCount).to.equal(1);
      const payload = stub.args[0][0];
      expect( payload.method ).to.equal( "POST" );
      expect( payload.url ).to.equal( AlLocatorService.resolveURL( AlLocation.GlobalAPI, `/aims/v1/authenticate` ) );
    });
  });
  describe('when changing a user password', () => {
    it('should call post() on the AlDefaultClient instance with a correctly constructed payload', async() => {
      const email = 'someone@somewhere.com';
      const password = 'xyz123';
      const newPassword = 'ABC007';
      await AIMSClient.changePassword(email, password, newPassword);
      expect(stub.callCount).to.equal(1);
      const payload = stub.args[0][0];
      expect( payload.method ).to.equal( "POST" );
      expect( payload.url ).to.equal( `${apiBaseURL}/aims/v1/change_password` );
      expect( payload.data ).to.deep.equal( { email, current_password: password, new_password: newPassword } );
    });
  });
  describe('when retrieving tokenInfo', () => {
    it('should call fetch() on the AlDefaultClient instance with a correctly constructed payload', async() => {
      await AIMSClient.tokenInfo();
      expect(stub.callCount).to.equal(1);
      const payload = stub.args[0][0];
      expect( payload.method ).to.equal( "GET" );
      expect( payload.url ).to.equal( `${apiBaseURL}/aims/v1/token_info` );
    });
  });
  describe("when retrieving token info for a specific token", () => {
    it("should call the correct URL", async() => {
      await AIMSClient.getTokenInfo( "ABCDEFGHIJKLMNOPQRSTUVWXYZ" );
      expect( stub.callCount ).to.equal( 1 );
      const payload = stub.args[0][0];
      expect( payload.method ).to.equal( "GET" );
      expect( payload.url ).to.equal( `${globalBaseURL}/aims/v1/token_info` );
      expect( payload.headers['X-AIMS-Auth-Token'] ).to.equal( 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' );
    } );
  } );
  describe('when initiating a password reset', () => {
    it('should call post() on the AlDefaultClient instance with a correctly constructed payload', async() => {
      const returnTo = 'https://console.alertlogic.net';
      const email = 'someone@somewhere.com';
      await AIMSClient.initiateReset(email, returnTo);
      expect(stub.callCount).to.equal(1);
      const payload = stub.args[0][0];
      expect( payload.method ).to.equal( "POST" );
      expect( payload.url ).to.equal( `${apiBaseURL}/aims/v1/reset_password` );
      expect( payload.data ).to.deep.equal( { email, return_to: returnTo } );
    });
  });
  describe('when initiating a password reset with a token', () => {
    it('should call set() on the AlDefaultClient instance with a correctly constructed payload', async() => {
      const token = 'xyz-123';
      const password = 'P@ssw0rd';
      await AIMSClient.resetWithToken(token, password);
      expect(stub.callCount).to.equal(1);
      const payload = stub.args[0][0];
      expect( payload.method ).to.equal( "PUT" );
      expect( payload.url ).to.equal( `${apiBaseURL}/aims/v1/reset_password/${token}` );
      expect( payload.data ).to.deep.equal( { password } );
    });
  });
  describe('when creating a new role', () => {
    it('should call post() on the AlDefaultClient instance with a correctly constructed payload', async() => {
      const name = 'RoleA';
      const permissions = { foo: 'bar' };
      await AIMSClient.createRole(accountId, name, permissions);
      expect(stub.callCount).to.equal(1);
      const payload = stub.args[0][0];
      expect( payload.method ).to.equal( "POST" );
      expect( payload.url ).to.equal( `${apiBaseURL}/aims/v1/${accountId}/roles` );
      expect( payload.data ).to.deep.equal( { name, permissions } );
    });
  });
  describe('when deleting a role', () => {
    it('should call delete() on the AlDefaultClient instance with a correctly constructed payload', async() => {
      const roleId = '00-22-xx-zz';
      await AIMSClient.deleteRole(accountId, roleId);
      expect(stub.callCount).to.equal(1);
      const payload = stub.args[0][0];
      expect( payload.method ).to.equal( "DELETE" );
      expect( payload.url ).to.equal( `${apiBaseURL}/aims/v1/${accountId}/roles/${roleId}` );
    });
  });
  describe('when retrieving a global role', () => {
    it('should call fetch() on the AlDefaultClient instance with a correctly constructed payload', async() => {
      const roleId = '00-22-xx-zz';
      await AIMSClient.getGlobalRole(roleId);
      expect(stub.callCount).to.equal(1);
      const payload = stub.args[0][0];
      expect( payload.method ).to.equal( "GET" );
      expect( payload.url ).to.equal( `${apiBaseURL}/aims/v1/roles/${roleId}` );
    });
  });
  describe('when retrieving an account role', () => {
    it('should call fetch() on the AlDefaultClient instance with a correctly constructed payload', async() => {
      const roleId = '00-22-xx-zz';
      await AIMSClient.getAccountRole(accountId, roleId);
      expect(stub.callCount).to.equal(1);
      const payload = stub.args[0][0];
      expect( payload.method ).to.equal( "GET" );
      expect( payload.url ).to.equal( `${apiBaseURL}/aims/v1/${accountId}/roles/${roleId}` );
    });
  });
  describe('when retrieving all global roles', () => {
    it('should call fetch() on the AlDefaultClient instance to the roles endpoint', async() => {
      await AIMSClient.getGlobalRoles();
      expect(stub.callCount).to.equal(1);
      const payload = stub.args[0][0];
      expect( payload.method ).to.equal( "GET" );
      expect( payload.url ).to.equal( `${apiBaseURL}/aims/v1/roles` );
    });
  });
  describe('when retrieving all account roles', () => {
    it('should call fetch() on the AlDefaultClient instance to the roles endpoint', async() => {
      await AIMSClient.getAccountRoles(accountId);
      expect(stub.callCount).to.equal(1);
      const payload = stub.args[0][0];
      expect( payload.method ).to.equal( "GET" );
      expect( payload.url ).to.equal( `${apiBaseURL}/aims/v1/${accountId}/roles` );
    });
  });
  describe('when updating the name and permissions of a role', () => {
    it('should call post() on the AlDefaultClient instance to the roles endpoint with a payload containing the name and permissions', async() => {
      const name = 'Mega Power User';
      const permissions = { '*:own:*:*': 'allowed', 'aims:own:grant:*':'allowed' };
      await AIMSClient.updateRole(accountId, name, permissions);
      expect(stub.callCount).to.equal(1);
      const payload = stub.args[0][0];
      expect( payload.method ).to.equal( "POST" );
      expect( payload.url ).to.equal( `${apiBaseURL}/aims/v1/${accountId}/roles` );
    });
  });
  describe('when updating the name of a role', () => {
    it('should call post() on the AlDefaultClient instance to the roles endpoint with a payload containing the name', async() => {
      const name = 'Mega Power User';
      await AIMSClient.updateRoleName(accountId, name);
      expect(stub.callCount).to.equal(1);
      const payload = stub.args[0][0];
      expect( payload.method ).to.equal( "POST" );
      expect( payload.url ).to.equal( `${apiBaseURL}/aims/v1/${accountId}/roles` );
      expect( payload.data ).to.deep.equal( { name } );
    });
  });
  describe('when updating the permissions of a role', () => {
    it('should call post() on the AlDefaultClient instance to the roles endpoint with a payload containing the name', async() => {
      const permissions = { '*:own:*:*': 'allowed', 'aims:own:grant:*':'allowed' };
      await AIMSClient.updateRolePermissions(accountId, permissions);
      expect(stub.callCount).to.equal(1);
      const payload = stub.args[0][0];
      expect( payload.method ).to.equal( "POST" );
      expect( payload.url ).to.equal( `${apiBaseURL}/aims/v1/${accountId}/roles` );
      expect( payload.data ).to.deep.equal( { permissions } );
    });
  });
  describe('when enrolling a users MFA device', () => {
    it('should call post() on the AlDefaultClient instance to the mfa endpoint with the supplied uri and codes', async() => {
      const uri = 'otpauth://totp/Alert%20Logic:admin@company.com?secret=GFZSA5CINFJSA4ZTNNZDG5BAKM2EMMZ7&issuer=Alert%20Logic&algorithm=SHA1';
      const codes = ['123456', '456789'];
      await AIMSClient.enrollMFA(uri, "Some Token", codes);
      expect(stub.callCount).to.equal(1);
      const payload = stub.args[0][0];
      expect( payload.method ).to.equal( "POST" );
      expect( payload.url ).to.equal( `${apiBaseURL}/aims/v1/user/mfa/enroll` );
      expect( payload.data ).to.deep.equal( { mfa_uri: uri, mfa_codes: codes } );
    });
  });
  describe('when removing a users MFA device', () => {
    it('should call delete() on the AlDefaultClient instance to the mfa endpoint with the supplied email', async() => {
      const email = 'admin@company.com';
      await AIMSClient.deleteMFA(email);
      expect(stub.callCount).to.equal(1);
      const payload = stub.args[0][0];
      expect( payload.method ).to.equal( "DELETE" );
      expect( payload.url ).to.equal( `${apiBaseURL}/aims/v1/user/mfa/${email}` );
    });
  });
  describe('when retrieving user details', () => {
    it('should call fetch() on the AlDefaultClient instance to the users endpoint with any extra params supplied', async() => {
      const reqParams = { include_role_ids: true, include_user_credential: true };
      await AIMSClient.getUserDetails(accountId, userId, reqParams);
      expect(stub.callCount).to.equal(1);
      const payload = stub.args[0][0];
      expect( payload.method ).to.equal( "GET" );
      expect( payload.url ).to.equal( `${apiBaseURL}/aims/v1/${accountId}/users/${userId}` );
    });
  });
  describe('when retrieving users', () => {
    it('should call fetch() on the AlDefaultClient instance to the users endpoint with any extra params supplied', async() => {
      const reqParams = { include_role_ids: true, include_user_credential: true };
      await AIMSClient.getUsers(accountId, reqParams);
      expect(stub.callCount).to.equal(1);
      const payload = stub.args[0][0];
      expect( payload.method ).to.equal( "GET" );
      expect( payload.url ).to.equal( `${apiBaseURL}/aims/v1/${accountId}/users` );
    });
  });
  describe('when creating an access key', () => {
    it('should call post() on the AlDefaultClient instance to the access_keys endpoint with the label value supplied', async() => {
      const label = 'my-key';
      await AIMSClient.createAccessKey(accountId, userId, label);
      expect(stub.callCount).to.equal(1);
      const payload = stub.args[0][0];
      expect( payload.method ).to.equal( "POST" );
      expect( payload.url ).to.equal( `${apiBaseURL}/aims/v1/${accountId}/users/${userId}/access_keys` );
      expect( payload.data ).to.deep.equal( { label } );
    });
  });
  describe('when updating an access key', () => {
    it('should call post() on the AlDefaultClient instance to the access_keys endpoint with the label value supplied', async() => {
      const label = 'my-key';
      const accessKeyId = '002211-22dddc';
      await AIMSClient.updateAccessKey(accessKeyId, label);
      expect(stub.callCount).to.equal(1);
      const payload = stub.args[0][0];
      expect( payload.method ).to.equal( "POST" );
      expect( payload.url ).to.equal( `${apiBaseURL}/aims/v1/access_keys/${accessKeyId}` );
      expect( payload.data ).to.deep.equal( { label } );
    });
  });
  describe('when retrieving an access key', () => {
    it('should call fetch() on the AlDefaultClient instance to the access_keys endpoint for the supplied access key id value', async() => {
      const accessKeyId = '002211-22dddc';
      await AIMSClient.getAccessKey(accessKeyId);
      expect(stub.callCount).to.equal(1);
      const payload = stub.args[0][0];
      expect( payload.method ).to.equal( "GET" );
      expect( payload.url ).to.equal( `${apiBaseURL}/aims/v1/access_keys/${accessKeyId}` );
    });
  });
  describe('when retrieving all access keys for a user', () => {
    it('should call fetch() on the AlDefaultClient instance to the access_keys endpoint for the supplied user id value', async() => {
      await AIMSClient.getAccessKeys(accountId, userId );
      expect(stub.callCount).to.equal(1);
      const payload = stub.args[0][0];
      expect( payload.method ).to.equal( "GET" );
      expect( payload.url ).to.equal( `${apiBaseURL}/aims/v1/${accountId}/users/${userId}/access_keys?out=full` );
    });
  });
  describe('when deleting an access key for a user', () => {
    it('should call delete() on the AlDefaultClient instance to the access_keys endpoint for the supplied user and access key id values', async() => {
      const accessKeyId = '002211-22dddc';
      await AIMSClient.deleteAccessKey(accountId, userId, accessKeyId);
      expect(stub.callCount).to.equal(1);
      const payload = stub.args[0][0];
      expect( payload.method ).to.equal( "DELETE" );
      expect( payload.url ).to.equal( `${apiBaseURL}/aims/v1/${accountId}/users/${userId}/access_keys/${accessKeyId}` );
    });
  });
  describe( 'AIMSEnrollURI', () => {
      it("should be constructable", () => {
          let uri = new AIMSEnrollURI( "knielsen@alertlogic.com", "dunderMifflin1234" );
          let uriValue = uri.toString();
          expect( uriValue ).to.equal(`otpauth://totp/Alert%20Logic:knielsen@alertlogic.com?secret=dunderMifflin1234&issuer=Alert%20Logic&algorithm=SHA1` );
      } );
  } );
});
