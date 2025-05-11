import { vi, it, expect, describe, test, beforeEach, afterEach } from 'vitest';
import {
    AlLocation,
    AlLocatorService,
    AlRoute,
    AlRouteCondition,
    AlRouteDefinition,
    AlRoutingHost,
} from '@al/core';

const menuDefinition:AlRouteDefinition = {
    caption: "root",
    children: [
        {
            caption: "Feature A",
            action: {
                type: "link",
                location: AlLocation.MagmaUI,
                path: '/#/feature/a/dashboard'
            },
        },
        {
            caption: "Feature B",
            action: {
                type: "link",
                location: AlLocation.MagmaUI,
                path: '/#/feature/b/list'
            },
        },
        {
            caption: "Feature K",
            action: {
                type: "link",
                location: AlLocation.AccountsUI,
                path: '/#/feature/k/is/fictional',
                matches: [
                    '/#/event-horizon/.*'
                ]
            },
            children: [
                {
                    caption: "K - Lost in Space",
                    action: {
                        type: "link",
                        location: AlLocation.MagmaUI,
                        path: '/#/nonstandard/weird/link'
                    },
                },
                {
                    caption: "K - Event Horizon",
                    action: {
                        type: "link",
                        location: AlLocation.MagmaUI,
                        path: "/#/event-horizon"
                    },
                    matches: [
                        '/#/event-horizon/.*',
                        '/#/lost-in-space/.*'
                    ]
                }
            ]
        },
    ]
}

export class MockRoutingHost implements AlRoutingHost {
    currentUrl = "https://console.alertlogic.com/#/remediations-scan-status/2";
    routeParameters = {};

    constructor( public currentUrl:string = "https://console.alertlogic.com/#/",
                 public entitlements:{[entitlement:string]:boolean} = {} ) {
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

let routingHost:AlRoutingHost;
let menu:AlRoute;

describe( 'Route Activation', () => {

    const fakeEntitlements = {
        'a': true,
        'b': false,
        'c': true,
        'd': false
    };

    beforeEach( () => {
        routingHost = new MockRoutingHost( "https://console.alertlogic.com/#/blah", fakeEntitlements );
        menu = new AlRoute( routingHost, menuDefinition );
        AlLocatorService.reset();
        AlLocatorService.setActingUrl("https://console.alertlogic.com/#/something" );
        routingHost.routeParameters["accountId"] = "2";
        routingHost.routeParameters["deploymentId"] = "1234ABCD-1234-ABCD1234";
        AlRoute.reCache = {};
    } );

    afterEach( () => vi.restoreAllMocks() );

    it( "shouldn't activate anything without a match", () => {
        routingHost.currentUrl = "https://console.alertlogic.com/#/queryparams/2?aaid=2&locid=defender-us-denver&filter1=value1&filter2=value2";
        menu.refresh( true );

        let activated = menu.getActivationCursor();

        expect( activated ).to.equal( undefined );
    } );

    it( "should activate exact matches exactly", () => {
        routingHost.currentUrl = "https://console.alertlogic.com/#/feature/a/dashboard?aaid=2&locid=defender-us-denver&filter1=value1&filter2=value2";
        menu.refresh( true );
        let activated = menu.getActivationCursor();
        expect( activated ).to.be.an("object");
        expect( activated.caption ).to.equal("Feature A" );
    } );

    it( "should activate based on local match patterns", () => {
        routingHost.currentUrl = "https://console.alertlogic.com/#/event-horizon/death/5?aaid=121212&locid=defender-us-ashburn";
        menu.refresh( true );
        let activated = menu.getActivationCursor();
        expect( activated ).to.be.an("object");
        expect( activated.caption ).to.equal("K - Event Horizon" );
        expect( activated.parent ).to.be.an("object");
        expect( activated.parent.caption ).to.equal("Feature K" );
        expect( activated.parent.activated ).to.equal(true);
    } );
} );
