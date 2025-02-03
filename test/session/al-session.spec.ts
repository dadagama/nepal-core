import {
    assert,
    expect,
} from 'chai';
import { describe } from 'mocha';
import * as sinon from 'sinon';
import {
    AIMSClient,
    AIMSAccount,
    AIMSSessionDescriptor,
    AlClientBeforeRequestEvent,
    AlDefaultClient,
    AlDataValidationError,
    AlSession,
    AlSessionInstance,
    AlCabinet,
    SubscriptionsClient,
    AlEntitlementCollection,
    AlRuntimeConfiguration,
} from "@al/core";
import {
    exampleActing,
    exampleSession,
} from '../mocks/session-data.mocks';
import { DefaultDataRetentionPolicy } from "../../src/subscriptions-client";



const sessionDescriptor = {
  authentication: {
      user: {
        id: '12345-ABCDE',
        name: 'Alert Logic',
        email: 'alertlogic@unknown.com',
        active: true,
        locked: false,
        version: 1,
        linked_users: [],
        created: {
          at: 0,
          by: 'ui-team',
        },
        modified: {
          at: 0,
          by: 'ui-team',
        },
      },
      account: {
        id: '2',
        name: 'Alert Logic',
        active: false,
        accessible_locations: ['location-a', 'location-b'],
        default_location: 'location-a',
        mfa_required: false,
        created: {
          at: 0,
          by: 'ui-team',
        },
        modified: {
          at: 0,
          by: 'ui-team',
        },
      },
      token: 'abig-fake.JUICY-token',
      token_expiration: + new Date() + 86400,
  }
};

const actingAccount: AIMSAccount = {
  id: '5',
  name: 'ACME Corp',
  active: false,
  version: 1,
  accessible_locations: ['location-a', 'location-b'],
  default_location: 'location-a',
  created: {
    at: 0,
    by: 'al-ui-team',
  },
  modified: {
    at: 0,
    by: 'al-ui-team',
  },
};

describe('AlSession Test Suite:', () => {
  let storage = AlCabinet.persistent("al_session" );
  let accountDetailsStub;
  let managedAccountsStub;
  let entitlementsStub;
  beforeEach( async () => {
    accountDetailsStub = sinon.stub( AIMSClient, 'getAccountDetails' ).returns( Promise.resolve( actingAccount ) );
    managedAccountsStub = sinon.stub( AIMSClient, 'getManagedAccounts' ).returns( Promise.resolve( [] ) );
    entitlementsStub = sinon.stub( SubscriptionsClient, 'getEntitlements' );
    entitlementsStub.withArgs("2").resolves( AlEntitlementCollection.fromArray( [ 'cloud_defender', 'cloud_insight' ] ) );
    entitlementsStub.withArgs("5").resolves( AlEntitlementCollection.fromArray( [ 'assess', 'detect', 'respond' ] ) );
    await AlSession.setAuthentication(sessionDescriptor);
  });
  afterEach( () => {
      sinon.restore();
  } );

  describe('After installing a session with `setAuthentication`', () => {
    it('should persist this to local storage"', () => {
      let session = storage.get( "session" );
      expect( session ).to.be.an( 'object' );
      expect( session.authentication ).to.be.an( 'object' );
      expect( session.authentication ).to.deep.equal( sessionDescriptor.authentication );
    });
    it('should provide the correct token from `.getToken()`', () => {
      expect(AlSession.getToken()).to.equal(sessionDescriptor.authentication.token);
    });
    it('should retrieve the correct expiration timestamp from `.getTokenExpiry()`', () => {
      expect(AlSession.getTokenExpiry()).to.equal(sessionDescriptor.authentication.token_expiration);
    });
    it('should retrieve the correct user ID from `.getUserID()`', () => {
      expect(AlSession.getUserID()).to.equal(sessionDescriptor.authentication.user.id);
    });
    it('should retrieve the correct user name from `.getUserName()`', () => {
      expect(AlSession.getUserName()).to.equal(sessionDescriptor.authentication.user.name);
    });
    it('should retrieve the correct email from `.getUserEmail()`', () => {
      expect(AlSession.getUserEmail()).to.equal(sessionDescriptor.authentication.user.email);
    });
    it('should retrieve the correct account id from `.getUserAccountID()`', () => {
      expect(AlSession.getUserAccountID()).to.equal(sessionDescriptor.authentication.account.id);
    });
    it('should retrieve the authentication record from `.getAuthentication()`', () => {
      expect(AlSession.getAuthentication()).to.deep.equal(sessionDescriptor.authentication);
    });
    it('should retrieve the correct values from `.getUserAccessibleLocations()`', () => {
      expect(AlSession.getUserAccessibleLocations()).to.deep.equal(sessionDescriptor.authentication.account.accessible_locations);
    });
    describe('On setting the session token details', () => {
      it('should persisted these correctly', () => {
        const token = 'my-token.is-great';
        const tokenExpiry = + new Date() + 1000;
        AlSession.setTokenInfo(token, tokenExpiry);
        expect(AlSession.getToken()).to.equal(token);
        expect(AlSession.getTokenExpiry()).to.equal(tokenExpiry);
      });
    } );
  });
  describe('After changing the acting account', async () => {
    beforeEach( async () => {
      await AlSession.setActingAccount(actingAccount);
    } );
    it('should persist the acting account to local storage', () => {
      const auth = storage.get("session" );
      expect(auth.acting).to.deep.equal(actingAccount);
    });
    it('should return the correct account ID from `.getActingAccountID()`', () => {
      expect(AlSession.getActingAccountID()).to.equal(actingAccount.id);
    });
    it('should return the correct acting account name from `getActingAccountName()`', () => {
      expect(AlSession.getActingAccountName()).to.equal(actingAccount.name);
    });
    it('should return the correct acting account record from `.getActingAccount()`', () => {
      expect(AlSession.getActingAccount()).to.deep.equal(actingAccount);
    });
    it('should return the correct locations from `.getActingAccountAccessibleLocation()`', () => {
      expect(AlSession.getActingAccountAccessibleLocations()).to.equal(actingAccount.accessible_locations);
    });
    it('should retrieve the correct location from `.getActingAccountDefaultLocation()`', () => {
      expect(AlSession.getActingAccountDefaultLocation()).to.equal(actingAccount.default_location);
    });
    it('should expose the correct entitlements via `.getEffectiveEntitlements().`', async () => {
        let entitlements = await AlSession.getEffectiveEntitlements();
        expect( entitlements.isEntitlementActive( 'assess' ) ).to.equal( true );
        expect( entitlements.isEntitlementActive( 'cloud_insight' ) ).to.equal( false );

        entitlements = AlSession.getEffectiveEntitlementsSync();
        expect( entitlements.isEntitlementActive( 'assess' ) ).to.equal( true );
        expect( entitlements.isEntitlementActive( 'cloud_insight' ) ).to.equal( false );


        let primary = await AlSession.getPrimaryEntitlements();
        expect( primary.isEntitlementActive( 'assess' ) ).to.equal( false );
        expect( primary.isEntitlementActive( 'cloud_insight' ) ).to.equal( true );

        primary = AlSession.getPrimaryEntitlementsSync();
        expect( primary.isEntitlementActive( 'assess' ) ).to.equal( false );
        expect( primary.isEntitlementActive( 'cloud_insight' ) ).to.equal( true );


    } );
    it( `should throw when setting the acting account to nothing`, async () => {
        return AlSession.setActingAccount( null )
            .then( () => Promise.reject( new Error('Expected method to reject') ),
                   err => assert.instanceOf( err, Error ) );
    } );
  } );
});

describe('After deactivating the session', () => {
  let storage = AlCabinet.persistent("al_session" );
  beforeEach(() => {
    AlSession.deactivateSession();
  });
  /** Disabled this because the session state may reflect annotations or artifacts of change that aren't included in the default session */
  it('should reflect that it has been deactivated', () => {
    expect(AlSession.isActive() ).to.equal( false );
  });
  it('should set remove the local storage item', () => {
    expect( storage.get("session") ).to.equal( null );
  });
});

describe('AlSession', () => {
  let storage = AlCabinet.persistent("al_session" );
  describe("constructor", () => {
    let accountDetailsStub, managedAccountsStub, entitlementsStub;
    beforeEach( () => {
      accountDetailsStub = sinon.stub( AIMSClient, 'getAccountDetails' ).returns( Promise.resolve( exampleSession.authentication.account ) );
      managedAccountsStub = sinon.stub( AIMSClient, 'getManagedAccounts' ).returns( Promise.resolve( [] ) );
      entitlementsStub = sinon.stub( SubscriptionsClient, 'getEntitlements' ).resolves( AlEntitlementCollection.fromArray( [ 'cloud_defender', 'cloud_insight' ] ) );
    } );
    afterEach( () => {
      sinon.restore();
      storage.destroy();
    } );
    it( "should ignore expired session data on initialization", () => {
      let sessionDescriptor = {
        authentication: {
            user: {
              id: '12345-ABCDE',
              name: 'Alert Logic',
              email: 'alertlogic@unknown.com',
              active: true,
              locked: false,
              version: 1,
              linked_users: [],
              created: {
                at: 0,
                by: 'ui-team',
              },
              modified: {
                at: 0,
                by: 'ui-team',
              },
            },
            account: {
              id: '2',
              name: 'Alert Logic',
              active: false,
              accessible_locations: ['location-a', 'location-b'],
              default_location: 'location-a',
              mfa_required: false,
              created: {
                at: 0,
                by: 'ui-team',
              },
              modified: {
                at: 0,
                by: 'ui-team',
              },
            },
            token: 'abig-fake.JUICY-token',
            token_expiration: ( Date.now() / 1000 ) - ( 60 * 60 ),
        }
      };
      storage.set("session", sessionDescriptor );
      let session = new AlSessionInstance();      //  sometimes it is easier to just not use singletons
      expect( session.isActive() ).to.equal( false );
      expect( storage.get("session" ) ).to.equal( null );
    } );

    it( "should authenticate localStorage if it is valid", async () => {
      storage.set("session", exampleSession );
      let session = new AlSessionInstance();
      await session.resolved();
      expect( session.isActive() ).to.equal( true );

      //    Secondary test: make sure the AlClientBeforeRequest hook works
      let event = new AlClientBeforeRequestEvent( { service_stack: 'insight:api', url: 'https://api.cloudinsight.alertlogic.com', headers: {} } );
      session.notifyStream.trigger( event );
      expect( event.request.headers.hasOwnProperty( 'X-AIMS-Auth-Token' ) ).to.equal( true );
      expect( event.request.headers['X-AIMS-Auth-Token'] ).to.equal( exampleSession.authentication.token );
    } );


  } );

  describe('when unauthenticated', () => {
    describe('account ID accessors', () => {
      it("should return NULL, rather than a string '0'", () => {
        let session:AlSessionInstance = new AlSessionInstance();
        //  Because returning '0' is stupid
        expect( session.getPrimaryAccountId() ).to.equal( null );
        expect( session.getActingAccountId() ).to.equal( null );
      } );
    } );
  } );

  describe('when authenticated', () => {
    describe('primary and acting accounts', () => {
      before( () => AlRuntimeConfiguration.options.noAccountMetadata = true );
      after( () => AlRuntimeConfiguration.reset() );
      it( 'should return expected values', async () => {
        let session:AlSessionInstance = new AlSessionInstance();
        await session.setAuthentication(exampleSession);
        let auth = session.getSession();
        expect( auth ).to.be.an( 'object' );
        expect( auth.authentication ).to.be.an( 'object' );
        expect( auth.authentication.token ).to.equal( exampleSession.authentication.token );

        expect( session.getPrimaryAccount() ).to.deep.equal( exampleSession.authentication.account );
        expect( session.getActingAccount() ).to.deep.equal( exampleSession.authentication.account );

        expect( session.getPrimaryAccountId() ).to.equal( exampleSession.authentication.account.id );
        expect( session.getActingAccountId() ).to.equal( exampleSession.authentication.account.id );

        session.deactivateSession();
      } );
    } );

  } );

  describe( 'authentication methods', () => {

    beforeEach( () => {
        storage.destroy();
        AlRuntimeConfiguration.options.noAccountMetadata = true;
    } );
    afterEach( () => {
        sinon.restore();
        AlRuntimeConfiguration.reset();
    } );

    describe( 'by username and password', () => {

      it( "should authenticate properly given a valid client response", async () => {
        let session = new AlSessionInstance();
        let clientAuthStub = sinon.stub( AlDefaultClient, 'authenticate' ).returns( Promise.resolve( exampleSession ) );

        expect( session.isActive() ).to.equal( false );
        let result = await session.authenticate( "mcnielsen@alertlogic.com", "b1gB1rdL!ves!" );
        expect( session.isActive() ).to.equal( true );
      } );

    } );

    describe( 'by MFA code and session token', () => {

      it( "should authenticate properly given a valid client response", async () => {
        let session = new AlSessionInstance();
        let clientAuthStub = sinon.stub( AlDefaultClient, 'authenticateWithMFASessionToken' ).returns( Promise.resolve( exampleSession ) );

        expect( session.isActive() ).to.equal( false );
        let result = await session.authenticateWithSessionToken( "SOME_ARBITRARY_SESSION_TOKEN", "123456" );
        expect( session.isActive() ).to.equal( true );
        session.deactivateSession();
      } );

    } );

    describe( 'by access token', () => {

      it( "should authenticate properly given a valid client response", async () => {
        let session = new AlSessionInstance();
        let clientAuthStub = sinon.stub( AIMSClient, 'getTokenInfo' ).returns( Promise.resolve( exampleSession.authentication ) );

        expect( session.isActive() ).to.equal( false );
        let result = await session.authenticateWithAccessToken( "SOME_ARBITRARY_ACCESS_TOKEN" );
        expect( session.isActive() ).to.equal( true );
        session.deactivateSession();
      } );

    } );

    describe( 'with acting account/location override', () => {
      it("should work", async () => {
        let session = new AlSessionInstance();
        let clientAuthStub = sinon.stub( AlDefaultClient, 'authenticate' ).returns( Promise.resolve( exampleSession ) );

        let fakeAccount = {
          id: '6710880',
          name: 'Big Bird & Friends, Inc.',
          accessible_locations: [ "defender-uk-newport", "insight-eu-ireland" ],
          default_location: "defender-uk-newport"
        } as AIMSAccount;

        expect( session.isActive() ).to.equal( false );
        let result = await session.authenticate( "mcnielsen@alertlogic.com", "b1gB1rdL!ves!", { actingAccount: fakeAccount, locationId: "defender-uk-newport" } );
        expect( session.isActive() ).to.equal( true );
        expect( session.getActingAccountId() ).to.equal( "6710880" );
        expect( session.getActiveDatacenter() ).to.equal( "defender-uk-newport" );
      } );
    } );

  } );

  describe( 'helper methods', () => {
    let session:AlSessionInstance;
    let accountDetailsStub;
    let managedAccountsStub;
    let entitlementsStub;
    let accountDetails = exampleActing;
    let managedAccounts = [];
    let entitlements = new AlEntitlementCollection();

    beforeEach( () => {
      session = new AlSessionInstance();
      accountDetailsStub = sinon.stub( AIMSClient, 'getAccountDetails' ).returns( Promise.resolve( accountDetails ) );
      managedAccountsStub = sinon.stub( AIMSClient, 'getManagedAccounts' ).returns( Promise.resolve( managedAccounts ) );
      entitlementsStub = sinon.stub( SubscriptionsClient, 'getEntitlements' ).returns( Promise.resolve( entitlements ) );
    } );

    afterEach( () => {
      sinon.restore();
      session.deactivateSession();
    } );

    describe( ".resolved()", () => {

      it("should not be resolved in an unauthenticated context", () => {
        expect( session['resolutionGuard']['fulfilled'] ).to.equal( false );
      } );

      it("should be resolved after authentication", async () => {
        session.setAuthentication( exampleSession );
        await session.resolved();
        expect( session.isActive() ).to.equal( true );
        expect( session['resolutionGuard']['fulfilled'] ).to.equal( true );
      } );
    } );

    describe( ".ready()", () => {
      it("detection guard should block in its initial state", () => {
        expect( session['detectionGuard']['fulfilled'] ).to.equal( false );
      } );
      it("detection guard should be resolved after a session detection cycle in an unauthenticated state", () => {
        session.startDetection();
        session.endDetection();
        expect( session['detectionGuard']['fulfilled'] ).to.equal( true );
      } );
      it("it should resolve after session detection/authentication resolved", ( done ) => {
        //  Dear World: this is an absolutely gruesome test...  my apologies.  Sincerely, Kevin.
        session.startDetection();
        setTimeout( () => {
          session.setAuthentication( exampleSession ).then( () => {
            session['resolutionGuard'].rescind();       //  pretend we're resolving an acting account
            session.endDetection();
            let resolved = false;
            session.ready().then( () => {
              resolved = true;
            }, ( error ) => {
              expect( true ).to.equal( false );
            } );

            setTimeout( () => {
              expect( resolved ).to.equal( false );
              session['resolutionGuard'].resolve( true );
              setTimeout( () => {
                expect( resolved ).to.equal( true );
                done();
              }, 1 );
            }, 1 );
          }, error => {
              expect( true ).to.equal( false );
          } );
        }, 1 );
      } );
    } );

    describe( ".getPrimaryEntitlementsSync()", () => {
        it("should return null in an unauthenticated state", () => {
            expect( session.getPrimaryEntitlementsSync() ).to.equal( null );
        } );
        it("should return viable entitlements if the session is authenticated", async () => {
            session.setAuthentication( exampleSession );
            await session.resolved();
            expect( session.getPrimaryEntitlementsSync() ).to.equal( session['resolvedAccount']['primaryEntitlements'] );
        } );
    } );

    describe( ".getPrimaryEntitlements()", () => {
      it("should return the entitlements of the primary account after account resolution is finished", ( done ) => {
        session.getPrimaryEntitlements().then( primaryEntitlements => {
          expect( primaryEntitlements ).to.equal( entitlements );
          done();
        } );
        session.setAuthentication( exampleSession );
      } );
    } );

    describe( ".getEffectiveEntitlementsSync()", () => {
        it("should return null in an unauthenticated state", () => {
            expect( session.getEffectiveEntitlementsSync() ).to.equal( null );
        } );
        it("should return viable entitlements if the session is authenticated", async () => {
            session.setAuthentication( exampleSession );
            await session.resolved();
            expect( session.getEffectiveEntitlementsSync() ).to.equal( session['resolvedAccount'].entitlements );
        } );
    } );

    describe( ".getEffectiveEntitlements()", () => {
      it("should return the entitlements of the acting account after account resolution is finished", ( done ) => {
        session.getEffectiveEntitlements().then( actingEntitlements => {
          expect( actingEntitlements ).to.equal( entitlements );
          done();
        }, error => {
            done( error );
        } );
        session.setAuthentication( exampleSession );
      } );
    } );

    describe( ".getManagedAccounts()", () => {
      it("should return the list of accounts managed by the primary account after account resolution is finished", async () => {
        session.setAuthentication( exampleSession );
        let accountList = await session.getManagedAccounts();
        expect( accountList ).to.deep.equal( managedAccounts );
      } );
    } );

    describe('getDataRetentionPeriod', () => {
      it('should return the data retention period in months for valid input', () => {
        // Mock resolvedAccount.entitlements.getProduct to return a valid product
        session['resolvedAccount'].entitlements.getProduct = () => ({ value_type: 'months', value: 21, productId: 'log_data_retention', active: true, expires: new Date() });

        const result = session.getDataRetetionPeriod();

        expect(result).to.equal(21);
      });

      it('should return the default data retention period for unrecognized unit', () => {
        // Mock resolvedAccount.entitlements.getProduct to return an unrecognized unit
        session['resolvedAccount'].entitlements.getProduct = () => ({ value_type: 'days', value: 6, productId: 'log_data_retention', active: true, expires: new Date() });

        const result = session.getDataRetetionPeriod();

        expect(result).to.equal(DefaultDataRetentionPolicy.Value);
      });

      it('should return the default data retention period on error', () => {
        // Mock resolvedAccount.entitlements.getProduct to throw an error
        session['resolvedAccount'].entitlements.getProduct = () => {
          throw new Error('Some error');
        }

        const result = session.getDataRetetionPeriod();

        expect(result).to.equal(DefaultDataRetentionPolicy.Value);
      });
    });

  } );

} );
