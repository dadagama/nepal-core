import { expect, describe, test, vi, beforeEach, afterEach } from 'vitest';
import { exampleSession } from '../mocks';
import {
    AlDefaultClient,
    AlAuthenticationUtility, AlAuthenticationResult,
    AlSession,
    AlRuntimeConfiguration
} from '@al/core';
import { AxiosResponse } from 'axios';

describe.skip('AlAuthenticationUtility', () => {

    let authenticator:AlAuthenticationUtility;

    beforeEach( () => {
        AlRuntimeConfiguration.options.noGestaltAuthentication = false;
        AlRuntimeConfiguration.options.noAccountMetadata = true;
        AlRuntimeConfiguration.setContext( "production" );
        vi.spyOn( AlSession, "ready" ).mockResolvedValue( true );
    } );

    afterEach( () => {
        vi.restoreAllMocks();
        AlRuntimeConfiguration.reset();
    } );

    describe( ".authenticate() without state", () => {
        beforeEach( () => {
            AlRuntimeConfiguration.options.noGestaltAuthentication = false;
            AlRuntimeConfiguration.options.noAccountMetadata = true;
            AlRuntimeConfiguration.setContext( "production" );
            vi.spyOn( AlSession, "ready" ).mockResolvedValue( true );
            AlSession.deactivateSession();
            authenticator = new AlAuthenticationUtility();
        } );

        test( "should understand successful authentication", async () => {
            vi.spyOn( AlDefaultClient, "authenticateViaGestalt" ).mockResolvedValue( exampleSession );
            let result = await authenticator.authenticate( "something", "password" );
            expect( result ).to.equal( AlAuthenticationResult.Authenticated );
        } );

        test( "should interpret MFA verification required responses", async () => {
            vi.spyOn( AlDefaultClient, "authenticateViaGestalt" ).mockRejectedValue( {
                data: {
                    error: "mfa_code_required"
                },
                status: 401,
                statusText: "NYET",
                headers: {
                    'x-aims-session-token': "MySessionToken"
                },
                config: null
            } );
            let result = await authenticator.authenticate( "something", "password" );
            expect( result ).to.equal( AlAuthenticationResult.MFAVerificationRequired );
            expect( authenticator.getSessionToken() ).to.equal( "MySessionToken" );
        } );

        test( "should interpret MFA enrollment required responses", async () => {
            vi.spyOn( AlDefaultClient, "authenticateViaGestalt" ).mockRejectedValue( {
                data: {
                    error: "mfa_enrollment_required"
                },
                status: 401,
                statusText: "NYET",
                headers: {
                    'x-aims-session-token': "MySessionToken"
                },
                config: null
            } );
            let result = await authenticator.authenticate( "something", "password" );
            expect( result ).to.equal( AlAuthenticationResult.MFAEnrollmentRequired );
            expect( authenticator.getSessionToken() ).to.equal( "MySessionToken" );
        } );

        test( "should interpret password reset required responses", async () => {
            vi.spyOn( AlDefaultClient, "authenticateViaGestalt" ).mockRejectedValue( {
                data: {
                    error: "password_expired"
                },
                status: 400,
                statusText: "NYET",
                headers: {},
                config: null
            } );
            let result = await authenticator.authenticate( "something", "password" );
            expect( result ).to.equal( AlAuthenticationResult.PasswordResetRequired );
        } );

        test( "should interpret TOS acceptance required responses", async () => {
            vi.spyOn( AlDefaultClient, "authenticateViaGestalt" ).mockRejectedValue( {
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
            } );
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

        test( "should handle successful validation", async () => {
            vi.spyOn( AlDefaultClient, "authenticateWithMFAViaGestalt" ).mockResolvedValue( exampleSession );
            let result = await authenticator.validateMfaCode( "123456" );
            expect( result ).to.equal( AlAuthenticationResult.Authenticated );
        } );

        test( "should handle unsuccessful validation", async () => {
            vi.spyOn( AlDefaultClient, "authenticateWithMFAViaGestalt" ).mockRejectedValue( {
                data: {},
                status: 401,
                statusText: "NYET",
                headers: {},
                config: null
            } );
            let result = await authenticator.validateMfaCode( "123456" );
            expect( result ).to.equal( AlAuthenticationResult.InvalidCredentials );
        } );
    } );

    describe( ".filterReturnURL()", () => {
        beforeEach( () => {
            AlSession.deactivateSession();
            authenticator = new AlAuthenticationUtility( { sessionToken: "MySessionToken" } );
        } );

        test( "should allow legit internal URLs", () => {
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

        test( "should allow localhost URLs", () => {
            let localURLs = [
                `https://localhost:99999/#/dashboards`,
                `http://localhost:4220/#/search/expert/2?aaid=2&locid=defender-us-denver`
            ];
            localURLs.forEach( url => {
                let value = authenticator.filterReturnURL( url );
                expect( value ).to.equal( url );
            } );
        } );

        test( "should reject external URLs", () => {
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

        test( "should allow the caller to override the default URL", () => {
            let result = authenticator.filterReturnURL( `https://google.com`, `https://console.alertlogic.com/#/path` );
            expect( result ).to.equal( `https://console.alertlogic.com/#/path` );
        } );
    } );

} );
