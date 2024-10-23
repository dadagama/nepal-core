import { WebAuth } from 'auth0-js';
import { expect } from 'chai';

import { describe } from 'mocha';
import * as sinon from 'sinon';
import { exampleSession } from '../mocks';
import { AlIdentityProviders, AlErrorHandler } from '@al/core';

describe('AlIdentityProviders', () => {
    let identityProviders:AlIdentityProviders;

    beforeEach( () => {
        identityProviders = new AlIdentityProviders();
    } );

    afterEach( () => {
        sinon.restore();
    } );

    describe(".inAuth0Workflow()", () => {
        it( "should distinguish auth0 redirection URLs", () => {
            const url1 = `https://console.magma.product.dev.alertlogic.com/`
                        + `?state=1656b907-98d2-4d60-8ad2-ef95227c363e`
                        + `&session_state=15160e1c-ed64-4d04-9957-a78956f55434`
                        + `&iss=https%3A%2F%2Ffoundation.foundation-stage.cloudops.fortradev.com%2Fidp%2Frealms%2Fproducts`
                        + `&code=7096de64-2a04-4f96-a46c-36d204b39db2.15160e1c-ed64-4d04-9957-a78956f55434.bf900b32-0776-4624-905d-6305d1227beb`;
            expect( AlIdentityProviders.inAuth0Workflow( url1 ) ).to.equal( false );

            const url2 = `https://console.magma.product.dev.alertlogic.com/`
                        + `?state=1656b907-98d2-4d60-8ad2-ef95227c363e`;
            expect( AlIdentityProviders.inAuth0Workflow( url2 ) ).to.equal( true );

            const url3 = `http://blahblahblah.com/?state=something&iss=something`;
            expect( AlIdentityProviders.inAuth0Workflow( url3 ) ).to.equal( false );

            const url4 = `http://blahblahblah.com/?state=something`;
            expect( AlIdentityProviders.inAuth0Workflow( url4 ) ).to.equal( true );
        } );
    } );

    describe(".warmup()", () => {
        it( "should return undefined for most URLs", () => {
            const url1 = `https://console.magma.product.dev.alertlogic.com/`
                        + `?state=1656b907-98d2-4d60-8ad2-ef95227c363e`
                        + `&session_state=15160e1c-ed64-4d04-9957-a78956f55434`
                        + `&iss=https%3A%2F%2Ffoundation.foundation-stage.cloudops.fortradev.com%2Fidp%2Frealms%2Fproducts`
                        + `&code=7096de64-2a04-4f96-a46c-36d204b39db2.15160e1c-ed64-4d04-9957-a78956f55434.bf900b32-0776-4624-905d-6305d1227beb`;
            expect( identityProviders['maybeRewriteBrokenURL']( url1 ) ).to.equal( undefined );

            const url2 = `http://www.google.com`;
            expect( identityProviders['maybeRewriteBrokenURL']( url2 ) ).to.equal( undefined );

        } );

        it( "should redirect known auth0 url malformations correctly", () => {
            AlErrorHandler.verbose = true;
            const url1 = `https://console.magma.product.dev.alertlogic.com/?state=something#/mfa/verify`;
            expect( identityProviders['maybeRewriteBrokenURL']( url1 ) )
                .to.equal( `https://console.magma.product.dev.alertlogic.com/#/mfa/verify?state=something` );

            const url2 = `https://console.magma.product.dev.alertlogic.com/?token=blippety&state=blop#/mfa/verify`;
            const result2 = identityProviders['maybeRewriteBrokenURL']( url2 );

            console.log("Full thing: %s", result2 );
        } );
    } );
} );
