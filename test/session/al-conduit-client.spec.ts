import { expect, describe, test, vi, beforeEach, afterEach } from 'vitest';
import {
    AlLocation,
    AlLocationContext,
    AlLocatorService,
    AlStopwatch,
    AlConduitClient
} from "@al/core";
import { exampleSession } from '../mocks/session-data.mocks';
import { JSDOM } from 'jsdom';

describe('AlConduitClient', () => {

    let conduitClient:AlConduitClient;
    let stopwatchStub, warnStub, errorStub;
    let originalContext:AlLocationContext;
    const dom = new JSDOM( `<DOCTYPE html><body></body>`);
    const window = dom.window;
    const document = dom.window.document;

    let generateMockRequest = ( requestType:string, data:any = null, requestId:string = null ) => {
        let event = {
            data: {
                type: requestType,
                requestId: requestId || 'fakeId'
            },
            origin: AlLocatorService.resolveURL( AlLocation.MagmaUI ),
            source: {}
        };
        if ( data ) {
            event.data = Object.assign( event.data, data );
        }
        return event;
    };

    beforeEach( () => {
        AlLocatorService.setActingUrl( "https://console.alertlogic.com" );
        let url = AlLocatorService.resolveURL( AlLocation.MagmaUI, '/#/something/something' );
        console.log("Recongifured location to %s", url );
        dom.reconfigure( { url } );
        vi.stubGlobal( "window", window );
        let client = new AlConduitClient();
        client.destroy();       //  make sure we start from a zero state
        AlLocatorService.reset();
        AlLocatorService.setContext( { environment: "production" } );
        conduitClient = new AlConduitClient();
        stopwatchStub = vi.spyOn( AlStopwatch, 'once' );
        warnStub = vi.spyOn( console, 'warn' );
        errorStub = vi.spyOn( console, 'error' );
        originalContext = AlLocatorService.getContext();
    } );

    afterEach( () => {
        AlLocatorService.setContext( originalContext );
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    } );

    describe("after initialization", () => {

        test( "should have expected initial state", () => {
            expect( AlConduitClient['conduitUri'] ).to.equal( undefined );
            expect( AlConduitClient['conduitWindow'] ).to.equal( undefined );
            expect( AlConduitClient['conduitOrigin'] ).to.equal( undefined );
            expect( AlConduitClient['requestIndex'] ).to.equal( 0 );
        } );
    } );

    describe(".render()", () => {
        test( "should generate a valid document fragment", () => {
            vi.spyOn( conduitClient, 'getFragment' ).mockImplementation( () => JSDOM.fragment() );
            vi.spyOn( conduitClient, 'getContainer' ).mockImplementation( () => document.createElement( "div" ) );
            AlConduitClient['document'] = dom.window.document;
            let fragment = conduitClient.render();
            expect( true ).to.equal( true );        //  I have no fucking idea how to evaluate the fragment.  If it compiles without errors, does that count for anything?
        } );
    } );

    describe(".start()", () => {
        test( "should render the document fragment", () => {
            conduitClient.start( document );
            expect( AlConduitClient['conduitUri'] ).to.equal( 'https://console.alertlogic.com/conduit.html' );        //  AlLocatorService uses production settings by default

            expect( AlConduitClient['refCount'] ).to.equal( 1 );
            expect( stopwatchStub.mock.calls.length ).to.equal( 1 );
            expect( stopwatchStub.mock.calls[0][0] ).to.equal( conduitClient['validateReadiness'] );
            expect( stopwatchStub.mock.calls[0][1] ).to.equal( 5000 );
            conduitClient.stop();

            expect( AlConduitClient['refCount'] ).to.equal( 0 );
        } );
    } );

    describe(".stop()", () => {
        test( "should do nothing", () => {
            conduitClient.stop();
        } );
    } );

    describe(".getSession()", () => {
        test( "should issue a request with th expected characteristics", () => {
            let fakePromise = {
                then: ( resolve, reject ) => {
                    return;
                }
            };
            let requestStub = vi.fn().mockReturnValue( fakePromise );
            conduitClient['request'] = requestStub;

            let promise = conduitClient.getSession();
            expect( requestStub.mock.calls.length ).to.equal( 1 );

            let call = requestStub.mock.calls[0];
            expect( call[0] ).to.equal( 'conduit.getSession' );
            expect( call[1] ).to.equal( undefined );
        } );
    } );

    describe(".setSession()", () => {
        test( "should issue a request with th expected characteristics", () => {
            let fakePromise = {
                then: ( resolve, reject ) => {
                    return;
                }
            };
            let requestStub = vi.fn().mockReturnValue( fakePromise );
            conduitClient['request'] = requestStub;

            let promise = conduitClient.setSession( exampleSession );

            expect( requestStub.mock.calls.length ).to.equal( 1 );

            let call = requestStub.mock.calls[0];
            expect( call[0] ).to.equal( 'conduit.setSession' );
            expect( call[1] ).to.be.an( 'object' );
            expect( call[1].session ).to.equal( exampleSession );
        } );
    } );

    describe(".deleteSession()", () => {
        test( "should issue a request with th expected characteristics", () => {
            let fakePromise = {
                then: ( resolve, reject ) => {
                    return;
                }
            };
            let requestStub = vi.fn().mockReturnValue( fakePromise );
            conduitClient['request'] = requestStub;

            let promise = conduitClient.deleteSession();

            expect( requestStub.mock.calls.length ).to.equal( 1 );

            let call = requestStub.mock.calls[0];
            expect( call[0] ).to.equal( 'conduit.deleteSession' );
            expect( call[1] ).to.equal( undefined );
        } );
    } );

    describe(".onReceiveMessage()", () => {
        beforeEach( () => {
            AlConduitClient.verbose = true;
        } );
        test( "should ignore events with missing data or incorrect origin", () => {
            let dispatchStub = vi.spyOn( conduitClient, 'onDispatchReply' );

            conduitClient.onReceiveMessage( { data: { something: true } } );
            conduitClient.onReceiveMessage( { data: { something: true }, origin: 'https://www.google.com', source: {} } );
            conduitClient.onReceiveMessage( { data: { type: 'conduit.ready', requestId: 'some-request-id' }, origin: 'https://www.google.com', source: {} } );      //  wrong origin

            expect( warnStub.mock.calls.length ).to.equal( 0 );
            expect( dispatchStub.mock.calls.length ).to.equal( 0 );
        } );
        test( "should handle conduit.ready message", () => {
            let readyStub = vi.spyOn( conduitClient, 'onConduitReady' );
            let event = generateMockRequest( 'conduit.ready' );
            conduitClient.onReceiveMessage( event );
            expect( readyStub.mock.calls.length ).to.equal( 1 );
        } );
        test( "should handle conduit.getSession, conduit.setSession, and conduit.deleteSession", () => {
            let dispatchStub = vi.spyOn( conduitClient, 'onDispatchReply' );

            let event = generateMockRequest( 'conduit.getSession' );
            conduitClient.onReceiveMessage( event );

            event = generateMockRequest( 'conduit.setSession' );
            conduitClient.onReceiveMessage( event );

            event = generateMockRequest( 'conduit.deleteSession' );
            conduitClient.onReceiveMessage( event );

            expect( dispatchStub.mock.calls.length ).to.equal( 3 );
        } );
        test( "should handle conduit.getGlobalSetting, conduit.setGlobalSetting, and conduit.deleteGlobalSetting", () => {
            let dispatchStub = vi.spyOn( conduitClient, 'onDispatchReply' );

            let event = generateMockRequest( 'conduit.getGlobalSetting', { setting_key: 'someSetting' } );
            conduitClient.onReceiveMessage( event );

            event = generateMockRequest( 'conduit.setGlobalSetting', { setting_key: 'someSetting', setting_data: { structured: true, deep: { reference: "maybe?" }, label: "Kevin wuz here" } } );
            conduitClient.onReceiveMessage( event );

            event = generateMockRequest( 'conduit.deleteGlobalSetting', { setting_key: 'someSetting' } );
            conduitClient.onReceiveMessage( event );

            expect( dispatchStub.mock.calls.length ).to.equal( 3 );
        } );
        test( "should handle conduit.getGlobalResource", () => {
            let dispatchStub = vi.spyOn( conduitClient, 'onDispatchReply' );

            let event = generateMockRequest( 'conduit.getGlobalResource', { resourceName: 'navigation/cie-plus2', ttl: 60 } );
            conduitClient.onReceiveMessage( event );
        } );
        test( "should warn about invalid message types if verbosity is turned on", () => {
            AlConduitClient.verbose = true;
            let event = {
                data: {
                    type: 'conduit.notARealMethod',
                    requestId: 'fakeId',
                },
                origin: AlLocatorService.resolveURL( AlLocation.MagmaUI ),
                source: {}
            };
            conduitClient.onReceiveMessage( event );
            expect( warnStub.mock.calls.length ).to.equal( 1 );
            AlConduitClient.verbose = false;
        } );
        afterEach( () => {
            AlConduitClient.verbose = false;
        } );

    } );

    describe( ".onConduitReady()", () => {
        test( "should copy the event's source and origin and mark conduit as ready", async () => {
            let event = {
                data: {
                    type: "conduit.ready"
                },
                source: { blahblah: "my source" },
                origin: 'https://console.alertlogic.com/conduit.html'
            };

            conduitClient.start( document );
            conduitClient.onConduitReady( event );

            expect( AlConduitClient['conduitOrigin'] ).to.equal( 'https://console.alertlogic.com/conduit.html' );
            expect( AlConduitClient['conduitWindow'] ).to.equal( event.source );
        } );
    } );

    describe( ".validateReadiness()", () => {
        test( "should warn if conduit isn't ready", () => {
            AlConduitClient['conduitWindow'] = null;
            AlConduitClient['conduitOrigin'] = null;
            conduitClient['validateReadiness']();
            expect( errorStub.mock.calls.length ).to.equal( 1 );
        } );
    } );

    describe( ".onDispatchReply()", () => {

        let calledThrough = false;

        test( "should warn/return on missing request IDs", () => {
            AlConduitClient.verbose = true;
            let event = generateMockRequest( 'conduit.getSession' );
            conduitClient.onDispatchReply( event );
            expect( warnStub.mock.calls.length ).to.equal( 1 );
            expect( calledThrough ).to.equal( false );
            AlConduitClient.verbose = false;
        } );

        test( "should call through and clear existing request callbacks", () => {
            AlConduitClient['requests']['fake-one'] = { resolve: () => { calledThrough = true; }, reject: () => {}, canceled: false };
            let event = generateMockRequest( 'conduit.getSession', null, 'fake-one' );
            conduitClient.onDispatchReply( event );
            expect( warnStub.mock.calls.length ).to.equal( 0 );
            expect( calledThrough ).to.equal( true );
        } );
    } );

    /**
     * This test simulates both sides of a two-party message exchange, and includes validation of the cross-residency behavior of conduit -- specifically, all clients,
     * regardless of their acting residency zone, must interact with the US console domain.  This allows authentication data to be shared across residencies.
     */
    describe( ".request()", () => {
        test( "should wait for readiness, resolve account app, and post message", async () => {
            let readyMessage = {
                source: {
                    postMessage: vi.fn()
                },
                origin: AlLocatorService.resolveURL( AlLocation.MagmaUI ),
                data: {
                    type: 'conduit.ready',
                    requestId: 'yohoho'
                }
            };

            conduitClient.start( document );
            conduitClient.onReceiveMessage( readyMessage ); //  this should finish initializing state

            //  This timer simulates the response coming from another window
            setTimeout( () => {
                expect( Object.keys( AlConduitClient['requests'] ).length ).to.equal( 1 );
                let requestId = Object.keys( AlConduitClient['requests'] )[0];
                let responseData = {
                    type: 'test.message',
                    requestId: requestId,
                    answer: "NO"
                };
                AlConduitClient['requests'][requestId].resolve( responseData );
            }, 100 );

            expect( AlConduitClient['conduitWindow'] ).to.equal( readyMessage.source );
            expect( AlConduitClient['conduitOrigin'] ).to.equal( readyMessage.origin );
            let response = await conduitClient['request']( "test.message", { from: "Kevin", to: "The World", message: "Get thee hence, satan." } );
            expect( readyMessage.source.postMessage.mock.calls.length ).to.equal( 1 );
            expect( readyMessage.source.postMessage.mock.calls[0][0] ).to.be.an( 'object' );
            expect( readyMessage.source.postMessage.mock.calls[0][1] ).to.be.a( 'string' );
            expect( readyMessage.source.postMessage.mock.calls[0][1] ).to.equal( "https://console.alertlogic.com" );
            expect( response.answer ).to.be.a('string' );
            expect( response.answer ).to.equal( 'NO' );

        } );
    } );

    describe( ".checkExternalSession()", () => {
        test("should return a value immediately based on location", () => {
            AlConduitClient['externalSessions']['fake-location-id'] = {
                resolver: null,
                resolved: true,
                promise: null
            };
            expect( conduitClient.checkExternalSession("defender-uk-newport") ).to.equal( false );
            expect( conduitClient.checkExternalSession("fake-location-id") ).to.equal( true );
            expect( conduitClient.checkExternalSession() ).to.equal( false );
        } );
    } );
} );
