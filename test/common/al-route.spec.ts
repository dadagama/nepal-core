import { vi, expect, describe, test, beforeEach, afterEach } from 'vitest';
import {
    AlLocation,
    AlLocatorService,
    AlRoute,
    AlRouteCondition,
    AlRouteDefinition,
    AlRoutingHost,
} from '@al/core';

export class MockRoutingHost implements AlRoutingHost {
    currentUrl = "https://console.alertlogic.com/#/remediations-scan-status/2";
    routeParameters = {};

    constructor( public entitlements:{[entitlement:string]:boolean} = {} ) {
    }

    dispatch = ( route:AlRoute ) => true;
    evaluate( condition:AlRouteCondition ):boolean|boolean[] {
        let results:boolean[] = [];
        if ( condition.entitlements ) {
            let entitlements = typeof( condition.entitlements ) === 'string' ? [ condition.entitlements ] : condition.entitlements;
            entitlements.forEach( entitlement => {
                results.push( this.entitlements.hasOwnProperty( entitlement ) && this.entitlements[entitlement] );
            } );
        }
        if ( condition.environments ) {
            const environment = AlLocatorService.getContext().environment;
            results.push( condition.environments.includes( environment ) );
        }
        return results;
    }

    setRouteParameter(parameter:string, value:string) {}
    getConditionById = (conditionId:string) => null;
    deleteRouteParameter(parameter:string) {}
    setBookmark(id:string, route:AlRoute ) {}
    getBookmark = (id:string):AlRoute => null;
}

test( 'AlRoute', () => {

    beforeEach( () => vi.restoreAllMocks() );
    afterEach( () => vi.restoreAllMocks() );

    const fakeEntitlements = {
        'a': true,
        'b': false,
        'c': true,
        'd': false
    };

    let routingHost = new MockRoutingHost( fakeEntitlements );

    beforeEach( () => {
        AlLocatorService.reset();
        AlLocatorService.setContext( { environment: "production", residency: 'US', insightLocationId: 'defender-us-denver' } );
        AlLocatorService.setActingUrl("https://console.alertlogic.com" );
        routingHost.routeParameters["accountId"] = "2";
        routingHost.routeParameters["deploymentId"] = "1234ABCD-1234-ABCD1234";
    } );

    describe( 'basic functionality', () => {
        it("should allow getting and setting of properties", () => {
            const menu = new AlRoute( routingHost, {
                caption: "Test Route",
                action: {
                    type: 'link',
                    location: AlLocation.MagmaUI,
                    path: '/#/remediations-scan-status/:accountId'
                },
                properties: {}
            } );
            menu.setProperty( 'kevin', 'was-here' );
            menu.setProperty( 'terriblySmart', false );
            menu.setProperty( 'hair', null );

            expect( menu.getProperty( "kevin" ) ).to.equal( "was-here" );
            expect( menu.getProperty( "terriblySmart" ) ).to.equal( false );
            expect( menu.getProperty( "hair" ) ).to.equal( null );
            expect( menu.getProperty( "doesntExist" ) ).to.equal( null );

            menu.setProperty( 'kevin', undefined );
            expect( menu.getProperty( 'kevin' ) ).to.equal( null );

            //  Test the default value for missing properties case too
            expect( menu.getProperty( 'kevin', false ) ).to.equal( false );
        } );
        it("deleting route properties should fall back on properties in the definition", () => {
            const route = new AlRoute( routingHost, {
                caption: "Test Route",
                properties: {
                    property1: "original"
                }
            } );
            expect(route.getProperty( "property1" ) ).to.equal("original" );
            route.setProperty( 'property1', 'newAndImproved' );
            expect(route.getProperty( "property1" ) ).to.equal("newAndImproved" );
            route.deleteProperty( 'property1' );
            expect(route.getProperty( "property1" ) ).to.equal("original" );
        } );
        it("should create routes using static `empty` method", () => {
            let route = AlRoute.empty();
            expect( route.caption ).to.be.a("string");
            expect( route.properties ).to.be.an("object");
            expect( route.children ).to.be.an("Array");
            expect( route.children.length ).to.equal( 0 );
        } );
        it("should create routes using static `link` method", () => {
            let route = AlRoute.link( routingHost, AlLocation.MagmaUI, '/#/some/random/path' );
            expect( route.caption ).to.be.a("string");
            expect( route.properties ).to.be.an("object");
            expect( route.children ).to.be.an("Array");
            expect( route.children.length ).to.equal( 0 );
            expect( route.href ).to.equal( "https://console.alertlogic.com/#/some/random/path" );
        } );
        it("should delegate `dispatch` calls to the routing host", () => {
            let route = AlRoute.link( routingHost, AlLocation.MagmaUI, '/#/some/random/path' );
            let dispatchStub = sinon.stub( routingHost, "dispatch" );

            route.dispatch();
            expect( dispatchStub.callCount ).to.equal( 1 );
            expect( dispatchStub.args[0][0] ).to.equal( route );
            dispatchStub.restore();
        } );
        it("should convert to HREF when `toHref` is called", () => {
            const route = AlRoute.link( routingHost, AlLocation.MagmaUI, '/#/some/random/path' );
            const routeHref = route.toHref();
            expect( routeHref ).to.equal( "https://console.alertlogic.com/#/some/random/path" );
        } );
        it("should call the host's href decorator if one is provided", () => {
            ( routingHost as any ).decorateHref = sinon.stub();
            const route = AlRoute.link( routingHost, AlLocation.MagmaUI, '/#/some/random/path' );
            expect( ( routingHost as any ).decorateHref.callCount ).to.equal( 1 );
        } );
        it("should allow remapping and normalize trailing slashes", () => {
            const route = AlRoute.link( routingHost, AlLocation.MagmaUI, '/#/some/random/path' );
            AlLocatorService.remapLocationToURI( AlLocation.MagmaUI, 'https://unrealdomain.com/subdirectory' );
            let routeHref = route.toHref();
            expect( routeHref ).to.equal( 'https://unrealdomain.com/subdirectory/#/some/random/path' );

            AlLocatorService.remapLocationToURI( AlLocation.MagmaUI, 'https://another.unrealdomain.com/other/subdirectory/' );
            routeHref = route.toHref();
            expect( routeHref ).to.equal( 'https://another.unrealdomain.com/other/subdirectory/#/some/random/path' );
        } );
        it("should use localized URLs when configured to do so", () => {
            AlRoute.truncateLocalURLs = true;
            const route = AlRoute.link( routingHost, AlLocation.MagmaUI, '/#/just/an/anchor/tag' );
            let routeHref = route.toHref();
            expect( routeHref ).to.equal( '#/just/an/anchor/tag' );

            const externalRoute = AlRoute.link( routingHost, AlLocation.OverviewUI, '/#/just/an/anchor/tag' );
            let externalHref = externalRoute.toHref();
            expect( externalHref ).to.equal("https://console.overview.alertlogic.com/#/just/an/anchor/tag" );
            AlRoute.truncateLocalURLs = false;
        } );
    } );

    describe( 'route construction', () => {
        it( 'should evaluate route HREFs properly', () => {
            const menu = new AlRoute( routingHost, {
                caption: "Test Route",
                action: {
                    type: 'link',
                    location: AlLocation.MagmaUI,
                    path: '/#/remediations-scan-status/:accountId'
                },
                properties: {}
            } );
            expect( menu.baseHREF ).to.equal( "https://console.alertlogic.com" );
            expect( menu.href ).to.equal( "https://console.alertlogic.com/#/remediations-scan-status/2" );
            expect( menu.visible ).to.equal( true );
        } );
        it( 'should evaluate optional route parameters in HREFs properly', () => {

            routingHost.routeParameters["accountId"] = "12345678";
            routingHost.routeParameters["userId"] = "ABCDEFGH";
            routingHost.routeParameters["deploymentId"] = "XXXX-YYYY-ZZZZZZZZ-1234";

            const menu = new AlRoute( routingHost, {
                caption: "Test Route",
                action: {
                    type: 'link',
                    location: AlLocation.MagmaUI,
                    path: '/#/path/to/:accountId/:userId%/:deploymentId%'
                },
                properties: {}
            } );

            menu.refresh();

            expect( menu.baseHREF ).to.equal( "https://console.alertlogic.com" );
            expect( menu.href ).to.equal( "https://console.alertlogic.com/#/path/to/12345678/ABCDEFGH/XXXX-YYYY-ZZZZZZZZ-1234" );
            expect( menu.visible ).to.equal( true );

            //  Delete the optional deploymentId parameter
            delete routingHost.routeParameters["deploymentId"];
            menu.refresh( true );

            expect( menu.baseHREF ).to.equal( "https://console.alertlogic.com" );
            expect( menu.href ).to.equal( "https://console.alertlogic.com/#/path/to/12345678/ABCDEFGH" );
            expect( menu.visible ).to.equal( true );

            //  Delete the optional userId parameter
            delete routingHost.routeParameters["userId"];
            menu.refresh( true );

            expect( menu.baseHREF ).to.equal( "https://console.alertlogic.com" );
            expect( menu.href ).to.equal( "https://console.alertlogic.com/#/path/to/12345678" );
            expect( menu.visible ).to.equal( true );

            //  Delete the required accountId parameter
            delete routingHost.routeParameters["accountId"];
            menu.refresh( true );

            expect( menu.baseHREF ).to.equal( "https://console.alertlogic.com" );
            expect( menu.href ).to.equal( "https://console.alertlogic.com/#/path/to/:accountId" );
            expect( menu.visible ).to.equal( false );
        } );
        it( 'should handle invalid locationIds properly with a warning', () => {
            let warnStub = sinon.stub( console, "warn" );
            const route = AlRoute.link( routingHost, null, "/#/some/silly/path" );
            expect( warnStub.callCount ).to.equal( 1 );
        } );
        it( 'should handle invalid route HREFs properly', () => {
            const menu = new AlRoute( routingHost, {
                caption: "Test Route",
                action: {
                    type: 'link',
                    location: AlLocation.MagmaUI,
                    path: '/#/path/:notExistingVariable/something'
                },
                properties: {}
            } );
            expect( menu.baseHREF ).to.equal( "https://console.alertlogic.com" );
            expect( menu.href ).to.equal( "https://console.alertlogic.com/#/path/:notExistingVariable/something" );
            expect( menu.visible ).to.equal( false );
        } );
        it( 'should handle invalid locations properly', () => {
            let warnStub = sinon.stub( console, "warn" );
            const menu = new AlRoute( routingHost, {
                caption: "Test Route",
                action: {
                    type: 'link',
                    location: "invalid:location",
                    path: '/#/path/:notExistingVariable/something'
                },
                properties: {}
            } );
            expect( menu.baseHREF ).to.equal( undefined );
            expect( menu.href ).to.equal( undefined );
            expect( menu.visible ).to.equal( false );
            expect( warnStub.callCount ).to.equal( 1 );
            warnStub.restore();
        } );
    } );

    describe( 'activation detection', () => {
        it( "should detect exact matches!", () => {
            routingHost.currentUrl = "https://console.alertlogic.com/#/path/2";
            const menu = new AlRoute( routingHost, {
                caption: "Test Route",
                action: {
                    type: 'link',
                    location: AlLocation.MagmaUI,
                    path: '/#/path/:accountId'
                },
                properties: {}
            } );
            menu.refresh();

            expect( menu.href ).to.equal( "https://console.alertlogic.com/#/path/2" );
            expect( menu.activated ).to.equal( true );
        } );
        it( "should ignore query parameters", () => {
            routingHost.currentUrl = "https://console.alertlogic.com/#/queryparams/2?aaid=2&locid=defender-us-denver&filter1=value1&filter2=value2";
            const menu = new AlRoute( routingHost, {
                caption: "Test Route",
                action: {
                    type: 'link',
                    location: AlLocation.MagmaUI,
                    path: '/#/queryparams/:accountId?locid=defender-us-denver&filter1=value1&aaid=2&filter2=value2'
                },
                properties: {}
            } );
            menu.refresh();

            expect( menu.activated ).to.equal( true );
        } );
    } );

    describe( 'given a simple menu definition', () => {

        const child1:AlRouteDefinition = {
            caption: "Child 1",
            visible: {
                entitlements: [ 'a' ]
            },
            action: {
                type: "link",
                location: AlLocation.MagmaUI,
                path: '/#/child-route-1'
            },
            properties: {}
        };
        const child2:AlRouteDefinition = {
            caption: "Child 2",
            visible: {
                rule: 'none',
                conditions: [
                    { entitlements: [ 'b' ] },
                    { entitlements: [ 'd' ] }
                ]
            },
            action: {
                type: "link",
                location: AlLocation.IncidentsUI,
                path: '/#/child-route-2'
            },
            properties: {}
        };
        const child3:AlRouteDefinition = {
            id: 'child3',
            caption: "Child 3",
            visible: {
                rule: 'all',
                conditions: [
                    { entitlements: [ 'a' ] },
                    { entitlements: [ 'c' ] },
                    { entitlements: [ 'd' ] }           /* this is false */
                ]
            },
            action: {
                type: "link",
                location: AlLocation.IncidentsUI,
                path: '/#/child-route-3'
            },
            properties: {},
            children: [
                {
                    id: "grandchild",
                    caption: "Third Level Item",
                    action: {
                        type: "link",
                        location: AlLocation.IncidentsUI,
                        path: '/#/child-route-3/grandchild'
                    }
                }
            ]
        };

        const menuDefinition:AlRouteDefinition = {
            caption: "Test Menu",
            children: [
                {
                    id: 'overview',
                    caption: "Overview",
                    action: {
                        type: "link",
                        location: AlLocation.MagmaUI,
                        path: '/#/'
                    },
                    matches: [ '/#/.*' ],
                    children: [
                        child1,
                        child2,
                        child3
                    ],
                    properties: {}
                },
                {
                    caption: "Details",
                    action: {
                        type: "link",
                        location: AlLocation.IncidentsUI,
                        path: '/#/'
                    },
                    properties: {}
                }
            ],
            properties: {}
        };

        it( "should be interpreted with a correct initial state", () => {
            const menu:AlRoute = new AlRoute( routingHost, menuDefinition );

            expect( menu.children.length ).to.equal( 2 );
            expect( menu.children[0].children.length ).to.equal( 3 );

            let route1 = menu.children[0].children[0];
            let route2 = menu.children[0].children[1];
            let route3 = menu.children[0].children[2];

            expect( route1.href ).to.equal( 'https://console.alertlogic.com/#/child-route-1' );
            expect( route1.visible ).to.equal( true );
            expect( route1.activated ).to.equal( false );

            expect( route2.href ).to.equal( 'https://console.incidents.alertlogic.com/#/child-route-2' );
            expect( route2.visible ).to.equal( true );
            expect( route2.activated ).to.equal( false );

            expect( route3.href ).to.equal( undefined );         // not visible?  no URL
            expect( route3.visible ).to.equal( false );
            expect( route3.activated ).to.equal( false );

        } );

        it( "should activate a route with a matching URL properly", () => {

            routingHost.currentUrl = "https://console.alertlogic.com/#/child-route-1";
            const menu:AlRoute = new AlRoute( routingHost, menuDefinition );

            let route1 = menu.children[0].children[0];

            expect( route1.activated ).to.equal( true );
            expect( menu.children[0].activated ).to.equal( true );
            expect( menu.activated ).to.equal( true );

        } );

        it( "should allow retrieval of items by ID and name", () => {
            const menu:AlRoute = new AlRoute( routingHost, menuDefinition );

            let grandchild1 = menu.findChild( "overview/child3/grandchild" );        //  Look up matching IDs
            let grandchild2 = menu.findChild( "overview/Child 3/Third Level Item" );       //  Look up matching captions

            expect( grandchild1 ).to.be.an( 'object' );
            expect( grandchild1 ).to.equal( grandchild2 );                  //  Should be the same

            let nonexistant = menu.findChild( "overview/Child 2/Does Not Exist" );
            expect( nonexistant ).to.equal( null );
        } );

        it( "should bookmark routes with a bookmarkId property in their definition", () => {
            let saveStub = sinon.stub( routingHost, "setBookmark" );
            let route = new AlRoute( routingHost, {
                caption: "Test Route",
                bookmarkId: "my-bookmark-id"
            } );
            expect( saveStub.callCount ).to.equal( 1 );
            expect( saveStub.args[0][0] ).to.equal( "my-bookmark-id" );
            expect( saveStub.args[0][1] ).to.equal( route );
            saveStub.restore();
        } );

        it( "should truncate local links to include only their anchor fragment", () => {
            AlRoute.truncateLocalURLs = true;
            const menu:AlRoute = new AlRoute( routingHost, menuDefinition );
            menu.refresh( true );
            let route1 = menu.children[0].children[0];
            let route2 = menu.children[0].children[1];

            expect( route1.href ).to.equal( '#/child-route-1' );
            expect( route2.href ).to.equal( 'https://console.incidents.alertlogic.com/#/child-route-2' );
            AlRoute.truncateLocalURLs = false;
        } );
    } );

    describe( "conditional evaluation", () => {
        it("should ignore unknown condition types and treat them as truthy", () => {
            let route = new AlRoute( routingHost, <AlRouteDefinition><unknown>{
                caption: "Test Route",
                action: {
                    type: "link",
                    url: "https://www.google.com"
                },
                visible: {
                    not_recognized: true
                }
            } );

            expect( route.visible ).to.equal( true );
        } );

        it("should evaluate path_matches as expected", () => {
            routingHost.currentUrl = "https://console.remediations.alertlogic.com/#/remediations-scan-status/2";
            let route = new AlRoute( routingHost, {
                caption: "Test Route",
                visible: {
                    path_matches: '/remediations-scan-status.*'
                }
            } );

            expect( route.visible ).to.equal( true );

            ( route.definition.visible as AlRouteCondition ).path_matches = "/something-else.*";
            route.refresh( true );
            expect( route.visible ).to.equal( false );
        } );

        it("should evaluate route parameter expressions as expected", () => {
            routingHost.routeParameters["param1"] = "alpha";
            routingHost.routeParameters["param2"] = "omega";

            let route = new AlRoute( routingHost, {
                caption: "Test Route",
                visible: {
                    parameters: [ "param1=alpha", "param2!=alpha" ]
                }
            } );

            expect( route.visible ).to.equal( true );   //  because param1 equals alpha and param2 doesn't

            let route2 = new AlRoute( routingHost, {
                caption: "Test Route",
                visible: {
                    parameters: [ "param3" ]
                }
            } );

            expect( route2.visible ).to.equal( false ); //  because param3 doesn't exist

            let route3 = new AlRoute( routingHost, {
                caption: "Test Route",
                visible: {
                    parameters: [ "param3!=anything_at_all", "param2=omega", "param1" ]
                }
            } );

            expect( route3.visible ).to.equal( true ); //  because param3 doesn't exist
        } );

        it("should evaluate environment conditionals as expected", () => {
            AlLocatorService.setActingUrl( "https://console.account.alertlogic.com" );
            let route = new AlRoute( routingHost, {
                caption: "Something",
                visible: {
                    environments: [ 'development', 'integration' ]
                }
            } );
            expect( route.visible ).to.equal( false );

            AlLocatorService.setActingUrl( "https://console.account.product.dev.alertlogic.com" );
            route.refresh();
            expect( route.visible ).to.equal( true );
        } );

        it("should evaluate compound conditionals using 'all' as expected", () => {
            routingHost.routeParameters["accountId"] = "2";
            routingHost.routeParameters["deploymentId"] = "funicular";
            fakeEntitlements["super_secret_feature"] = true;
            routingHost.currentUrl = "https://console.alertlogic.com/#/special/feature/path?filter=healthy";

            let route = new AlRoute( routingHost, {
                caption: "Something",
                visible: {
                    rule: 'all',
                    parameters: [ "accountId", "deploymentId" ],
                    path_matches: '/#/special/feature/path.*',
                    entitlements: [ 'super_secret_feature' ]
                }
            } );

            expect( route.visible ).to.equal( true );

            fakeEntitlements["super_secret_feature"] = false;   //  any condition resulting in false should cause the whole thing to evaluate to false

            route.refresh();

            expect( route.visible ).to.equal( false );
        } );

        it("should evaluate compound conditions using 'none' as expected", () => {
            routingHost.routeParameters["accountId"] = "2";
            let route = new AlRoute( routingHost, {
                caption: "Something",
                visible: {
                    rule: 'none',
                    parameters: [ "accountId", "jabberwocky" ],     //  <-- accountId is defined, so the routes visibility should initially be `false`
                    path_matches: '/#/some/path/i/am/not/on',
                    entitlements: [ 'some_undefined_entitlement' ]
                }
            } );

            expect( route.visible ).to.equal( false );

            delete routingHost.routeParameters["accountId"];

            route.refresh();

            expect( route.visible ).to.equal( true );

        } );

    } );
} );
