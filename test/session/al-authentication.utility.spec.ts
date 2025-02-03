import { expect } from 'chai';
import { describe } from 'mocha';
import * as sinon from 'sinon';
import { exampleSession } from '../mocks';
import {
    AlDefaultClient,
    AlAuthenticationUtility, AlAuthenticationResult,
    AlSession,
    AlRuntimeConfiguration
} from '@al/core';
import { AxiosResponse } from 'axios';

describe('AlAuthenticationUtility', () => {

    let authenticator:AlAuthenticationUtility;

    beforeEach( () => {
        AlRuntimeConfiguration.options.noGestaltAuthentication = false;
        AlRuntimeConfiguration.options.noAccountMetadata = true;
        AlRuntimeConfiguration.setContext( "production" );
        sinon.stub( AlSession, "ready" ).returns( Promise.resolve() );
    } );

    afterEach( () => {
        sinon.restore();
        AlRuntimeConfiguration.reset();
    } );

    describe( ".authenticate() without state", () => {
        beforeEach( () => {
            AlSession.deactivateSession();
            authenticator = new AlAuthenticationUtility();
        } );

        it( "should understand successful authentication", async () => {
            sinon.stub( AlDefaultClient, "authenticateViaGestalt" ).returns( Promise.resolve( exampleSession ) );
            let result = await authenticator.authenticate( "something", "password" );
            expect( result ).to.equal( AlAuthenticationResult.Authenticated );
        } );

        it( "should interpret MFA verification required responses", async () => {
            sinon.stub( AlDefaultClient, "authenticateViaGestalt" ).returns( Promise.reject( {
                data: {
                    error: "mfa_code_required"
                },
                status: 401,
                statusText: "NYET",
                headers: {
                    'x-aims-session-token': "MySessionToken"
                },
                config: null
            } ) );
            let result = await authenticator.authenticate( "something", "password" );
            expect( result ).to.equal( AlAuthenticationResult.MFAVerificationRequired );
            expect( authenticator.getSessionToken() ).to.equal( "MySessionToken" );
        } );

        it( "should interpret MFA enrollment required responses", async () => {
            sinon.stub( AlDefaultClient, "authenticateViaGestalt" ).returns( Promise.reject( {
                data: {
                    error: "mfa_enrollment_required"
                },
                status: 401,
                statusText: "NYET",
                headers: {
                    'x-aims-session-token': "MySessionToken"
                },
                config: null
            } ) );
            let result = await authenticator.authenticate( "something", "password" );
            expect( result ).to.equal( AlAuthenticationResult.MFAEnrollmentRequired );
            expect( authenticator.getSessionToken() ).to.equal( "MySessionToken" );
        } );

        it( "should interpret password reset required responses", async () => {
            sinon.stub( AlDefaultClient, "authenticateViaGestalt" ).returns( Promise.reject( {
                data: {
                    error: "password_expired"
                },
                status: 400,
                statusText: "NYET",
                headers: {},
                config: null
            } ) );
            let result = await authenticator.authenticate( "something", "password" );
            expect( result ).to.equal( AlAuthenticationResult.PasswordResetRequired );
        } );

        it( "should interpret TOS acceptance required responses", async () => {
            sinon.stub( AlDefaultClient, "authenticateViaGestalt" ).returns( Promise.reject( {
                data: {
                    error: "accept_tos_required",
                    tos_url: "https://lmgtfy.app/?q=Not+Implemented"
                },
                status: 401,
                statusText: "NYET",
                headers: {
                    'x-aims-session-token': "UglyToken"
                },
                config: null
            } ) );
            let result = await authenticator.authenticate( "something", "password" );
            expect( result ).to.equal( AlAuthenticationResult.TOSAcceptanceRequired );
            expect( authenticator.getSessionToken() ).to.equal( "UglyToken" );
            expect( authenticator.getTermsOfServiceURL() ).to.equal( "https://lmgtfy.app/?q=Not+Implemented" );
        } );

    } );

    describe( ".validateMfaCode()", () => {
        beforeEach( () => {
            AlSession.deactivateSession();
            authenticator = new AlAuthenticationUtility( { sessionToken: "MySessionToken" } );
        } );

        it( "should handle successful validation", async () => {
            sinon.stub( AlDefaultClient, "authenticateWithMFAViaGestalt" ).returns( Promise.resolve( exampleSession ) );
            let result = await authenticator.validateMfaCode( "123456" );
            expect( result ).to.equal( AlAuthenticationResult.Authenticated );
        } );

        it( "should handle unsuccessful validation", async () => {
            sinon.stub( AlDefaultClient, "authenticateWithMFAViaGestalt" ).returns( Promise.reject( {
                data: {},
                status: 401,
                statusText: "NYET",
                headers: {},
                config: null
            } ) );
            let result = await authenticator.validateMfaCode( "123456" );
            expect( result ).to.equal( AlAuthenticationResult.InvalidCredentials );
        } );
    } );

    describe( ".filterReturnURL()", () => {
        beforeEach( () => {
            AlSession.deactivateSession();
            authenticator = new AlAuthenticationUtility( { sessionToken: "MySessionToken" } );
        } );

        it( "should allow legit internal URLs", () => {
            let internalURLs = [
                `https://console.dashboards.alertlogic.com/#/some/silly/path`,
                `http://console.overview.alertlogic.com`,
                `https://ng-common-components.ui-dev.product.dev.alertlogic.com`,
                `https://console.exposures.alertlogic.co.uk/#/blah/2?aaid=2&locid=thppppt`,
                `https://console.alertlogic.net/events.php`
            ];

            internalURLs.forEach( url => {
                let value = authenticator.filterReturnURL( url );
                expect( value ).to.equal( url );
            } );
        } );

        it( "should allow localhost URLs", () => {
            let localURLs = [
                `https://localhost:99999/#/dashboards`,
                `http://localhost:4220/#/search/expert/2?aaid=2&locid=defender-us-denver`
            ];
            localURLs.forEach( url => {
                let value = authenticator.filterReturnURL( url );
                expect( value ).to.equal( url );
            } );
        } );

        it( "should reject external URLs", () => {
            let externalURLs = [
                `https://google.com`,
                `https://console.dashboards.alertlogic.hackery.com/#/some/silly/path`,
                `https://console.alertlogic-not.com`
            ];

            externalURLs.forEach( url => {
                let value = authenticator.filterReturnURL( url );
                expect( value ).to.equal( `https://console.account.alertlogic.com/#/` );
            } );
        } );

        it( "should allow the caller to override the default URL", () => {
            let result = authenticator.filterReturnURL( `https://google.com`, `https://console.alertlogic.com/#/path` );
            expect( result ).to.equal( `https://console.alertlogic.com/#/path` );
        } );
    } );

} );
