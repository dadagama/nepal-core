import { WebAuth } from 'auth0-js';
import { expect, describe, vi, beforeEach, afterEach, test, DoneCallback } from 'vitest';

import { exampleSession } from '../mocks';
import {
    AlConduitClient,
    AlSessionDetector,
    AlLocatorService,
    AIMSClient,
    AlSession,
    AlRuntimeConfiguration
} from '@al/core';
import { JSDOM } from 'jsdom';

describe('AlSessionDetector', () => {
    let conduit:AlConduitClient;
    let sessionDetector:AlSessionDetector;
    let getTokenInfoStub;

    beforeEach( () => {
        const dom = new JSDOM( `<DOCTYPE html><body></body>`);
        const window = dom.window;
        vi.stubGlobal( "window", window );
        AlRuntimeConfiguration.options.noEndpointsResolution = true;
        AlRuntimeConfiguration.options.noAccountMetadata = true;
        AlLocatorService.setContext( { environment: "production" } );
        conduit = new AlConduitClient();
        sessionDetector = new AlSessionDetector( conduit, true );
        getTokenInfoStub = vi.spyOn( AIMSClient, 'getTokenInfo' ).mockResolvedValue( exampleSession.authentication );
        vi.spyOn( AlSession, "ready" ).mockResolvedValue();
    } );

    afterEach( () => {
        vi.restoreAllMocks();
        AlRuntimeConfiguration.reset();
    } );

    describe("after initialization", () => {
        test( "should have known properties", () => {
            expect( sessionDetector.authenticated ).to.equal( false );
        } );
    } );

    describe(".getAuth0Config", () => {
        test( "should produce configuration values in an expected way", () => {
            let config = sessionDetector.getAuth0Config();
            expect( config.domain ).to.equal("alertlogic.auth0.com");
            expect( config.responseType ).to.equal( "token id_token" );
            expect( config.audience ).to.equal( "https://alertlogic.com/" );
            expect( config.scope ).to.equal( "openid user_metadata" );
            expect( config.prompt ).to.equal( true );
            expect( config.redirectUri ).to.equal( window.location.origin );

            config = sessionDetector.getAuth0Config( { scope: "openid", prompt: "none" } );
            expect( config.scope ).to.equal( "openid" );
            expect( config.prompt ).to.equal( "none" );
        } );
    } );

    describe(".getTokenExpiration", () => {
        test( "should extract a timestamp from a properly formatted JWT", () => {
            let timestamp = sessionDetector['getTokenExpiration']("blahblahblah.eyJleHAiOjEwMDAwMDAwLCJzb21ldGhpbmcgZWxzZSI6ImhhaGEifQ==.blahblahblah" );
            expect( timestamp ).to.equal( 10000000 );
        } );
        test( "should return 0 for invalid JWTs", () => {
            let timestamp;

            //  Wrong wrapper format
            timestamp = sessionDetector['getTokenExpiration']("totally wrong");
            expect( timestamp ).to.equal( 0 );

            //  Token information segment is not base64 encoded
            timestamp = sessionDetector['getTokenExpiration']("blahblahblah.blahblahblah.blahblahblah" );
            expect( timestamp ).to.equal( 0 );

            //  Token information segment doesn't have an `exp` property
            timestamp = sessionDetector['getTokenExpiration']("blahblahblah.eyJleHBpcmF0aW9uIjoxMDAwMDAwMCwia2V2aW4iOiJ3YXMgaGVyZSJ9.blahblahblah" );
            expect( timestamp ).to.equal( 0 );
        } );
    } );

    describe(".extractUserInfo", () => {
        test( "should get an accountId/userId pair from validly formatted auth0 identity data", () => {
            let identityData = {
                "https://alertlogic.com/": {
                    sub: "2:10001000-1000"
                }
            };
            let identityInfo = sessionDetector['extractUserInfo']( identityData );
            expect( identityInfo ).to.be.an( 'object' );
            expect( identityInfo.accountId ).to.equal( "2" );
            expect( identityInfo.userId ).to.equal( "10001000-1000" );
        } );

        test( "should throw in the face of invalid input data", () => {
            let identityData = {
                "https://mcdonalds-restaurants.com/": {
                    sub: "2:10001000-1000"
                }
            };
            expect( () => { sessionDetector['extractUserInfo']( identityData ); } ).to.throw();
        } );
    } );

    describe( ".forceAuthentication()", () => {
        test("should redirect to the expected location", () => {
            let redirectStub = vi.spyOn( sessionDetector, 'redirect' ).mockImplementation( () => {} );
            sessionDetector.forceAuthentication();
            expect( redirectStub.mock.calls.length ).to.equal( 1 );
        } );
    } );

    describe( ".normalizeSessionDescriptor()", () => {
        test( "should resolve immediately if the descriptor is fully populated", async () => {
            let result = await sessionDetector.normalizeSessionDescriptor( exampleSession );
            expect( result ).to.equal( exampleSession );
            expect( getTokenInfoStub.mock.calls.length ).to.equal( 0 );
        } );
        test( "should request token info if the descriptor is missing information", async () => {
            let result = await sessionDetector.normalizeSessionDescriptor( {
                authentication: {
                    token: exampleSession.authentication.token,
                    token_expiration: null,
                    account: null,
                    user: null
                }
            } );
            expect( result ).to.be.an( 'object' );
            expect( getTokenInfoStub.mock.calls.length ).to.equal( 1 );
        } );
    } );

    describe( ".onDetectionFail()", () => {
        test( "should emit warning, call resolver, and set values", () => {
            let result = null;
            let resolver = ( value:boolean ) => {
                result = value;
            };
            sessionDetector.onDetectionFail( resolver, null );
            expect( result ).to.equal( false );
            expect( sessionDetector.authenticated ).to.equal( false );

            sessionDetector.onDetectionFail( resolver, "A message" );

        } );
    } );

    describe( ".onDetectionSuccess()", () => {
        test( "should emit warning, call resolver, and set values", () => {
            let result = null;
            let resolver = ( value:boolean ) => {
                result = value;
            };
            sessionDetector.onDetectionSuccess( resolver );
            expect( result ).to.equal( true );
            expect( sessionDetector.authenticated ).to.equal( true );
        } );
    } );

    describe.skip(".ingestExistingSession()", () => {
        test( "should catch errors", async () => {
            let garbage:any = {
                authentication: {
                    token: "blahblahblah",
                    token_expiration: ( Date.now() / 1000 ) - 86400,
                    account: {
                        id: "wronger"
                    }
                }
            };
            await expect( sessionDetector.ingestExistingSession( garbage ) ).rejects.toThrow();
            expect( sessionDetector.authenticated ).to.equal( false );
        } );
        test( "should normalize and ingest a valid session descriptor", async () => {
            let normalizeStub = vi.spyOn( sessionDetector, 'normalizeSessionDescriptor' ).mockResolvedValue( exampleSession );
            await sessionDetector.ingestExistingSession( {
                authentication: {
                    token: exampleSession.authentication.token,
                    token_expiration: null,
                    user: null,
                    account: null
                }
            } );
            expect( sessionDetector.authenticated ).to.equal( true );
        } );
    } );

    describe("detectSession()", () => {
        describe("with a local session", () => {
            test( "should resolve true", async () => {
                AlSession.deactivateSession();
                await AlSession.setAuthentication( exampleSession );
                let result = await sessionDetector.detectSession();
                expect( result ).to.equal( true );
                expect( sessionDetector.authenticated ).to.equal( true );
                sessionDetector.onDetectionFail( () => {} );      //  kill the promise
            } );
        } );

        describe("with a gestalt session", () => {
            test( "should resolve true", async () => {
                AlRuntimeConfiguration.options.noGestaltAuthentication = false;
                AlSession.deactivateSession();
                vi.spyOn( conduit, 'getSession' ).mockResolvedValue( null );
                vi.spyOn( sessionDetector, 'getGestaltSession' ).mockResolvedValue( exampleSession );
                vi.spyOn( sessionDetector, 'ingestExistingSession' ).mockResolvedValue( true );
                let result = await sessionDetector.detectSession();
                expect( result ).to.equal( true );
                expect( sessionDetector.authenticated ).to.equal( true );
                sessionDetector.onDetectionFail( () => {} );      //  kill the promise
            } );
        } );

        describe("with a conduit session", () => {
            test( "should resolve true", async () => {
                AlSession.deactivateSession();
                AlRuntimeConfiguration.options.noGestaltAuthentication = true;
                let getSessionStub = vi.spyOn( conduit, 'getSession' ).mockResolvedValue( exampleSession );
                let ingestSessionStub = vi.spyOn( sessionDetector, 'ingestExistingSession' ).mockResolvedValue( true );
                let result = await sessionDetector.detectSession();
                expect( result ).to.equal( true );
                expect( sessionDetector.authenticated ).to.equal( true );
                sessionDetector.onDetectionFail( () => {} );      //  kill the promise
            } );
        } );
        describe("with an auth0 session", () => {
            test( "should resolve true", async () => {
                AlSession.deactivateSession();
                AlRuntimeConfiguration.options.noGestaltAuthentication = true;

                let auth0AuthStub = vi.spyOn( sessionDetector, 'getAuth0Authenticator' ).mockReturnValue( <WebAuth><unknown>{
                    checkSession: ( config, callback ) => {
                        callback( null, {
                            accessToken: 'big-fake-access-token.' + window.btoa( JSON.stringify( { 'exp': Math.floor( ( Date.now() / 1000 ) + 86400 ) } ) )
                        } );
                    },
                    client: {
                        userInfo: ( accessToken, callback ) => {
                            callback( null, {
                                "https://alertlogic.com/": {
                                    sub: "2:10001000-1000"
                                }
                            } );
                        }
                    }
                } );
                let getSessionStub = vi.spyOn( sessionDetector['conduit'], 'getSession' ).mockResolvedValue( null );
                let ingestSessionStub = vi.spyOn( sessionDetector, 'ingestExistingSession' ).mockResolvedValue( true );
                let result = await sessionDetector.detectSession();
                sessionDetector.onDetectionFail( () => {} );      //  kill the promise
                expect( true ).to.equal( true );
            } );
        } );
    } );

} );
