import { expect, describe, afterEach, test, vi } from 'vitest';
import { AxiosRequestConfig } from 'axios';
import {
    AlAPIServerError,
    AlBadGatewayError,
    AlBadRequestError,
    AlNotFoundError,
    AlDataValidationError,
    AlUnauthenticatedRequestError,
    AlUnauthorizedRequestError,
    AlUnimplementedMethodError,
} from '@al/core';

describe( `Errors`, () => {
    afterEach( () => {
        vi.restoreAllMocks();
    } );
    describe( 'AlAPIServerError', () => {

        test( 'should instantiate as expected', () => {
            const error = new AlAPIServerError( "Some error happened somewhere, somehow", "aims", 401 );

            expect( error.message ).to.be.a("string");
            expect( error.serviceName ).to.equal("aims" );
            expect( error.statusCode ).to.equal( 401 );
        } );

    } );

    describe( 'AlDataValidationError', () => {
        test( 'should instantiate as expected', () => {
            let requestConfig = {} as AxiosRequestConfig;
            let data = {} as unknown;
            const error = new AlDataValidationError( "Some error happened somewhere, somehow", data, 'https://something#definitions/something-else', [ { thing: true } ], requestConfig );

            expect( error.message ).to.be.a("string" );
            expect( error.validationErrors ).to.be.an("array");
            expect( error.validationErrors.length ).to.equal( 1 );
        } );
    } );

    describe( 'AlBadRequestError', () => {
        test( 'should instantiate as expected', () => {
            const error = new AlBadRequestError( "You made a bad request", "data", "aggregation.configuration.id", "This value cannot be specified for a creation request" );

            expect( error.httpResponseCode ).to.equal( 400 );
            expect( error.message ).to.be.a("string" );
            expect( error.inputType ).to.be.a("string" );
            expect( error.inputProperty ).to.be.a("string" );
            expect( error.description ).to.be.a("string" );
        } );
    } );
    describe( 'AlUnauthenticatedRequestError', () => {
        test( 'should instantiate as expected', () => {
            const error = new AlUnauthenticatedRequestError( "You cannot login in", "aims" );

            expect( error.httpResponseCode ).to.equal( 401 );
            expect( error.message ).to.be.a("string" );
            expect( error.authority ).to.be.a("string" );
        } );
    } );
    describe( 'AlUnauthorizedRequestError', () => {
        test( 'should instantiate as expected', () => {
            const error = new AlUnauthorizedRequestError( "You cannot access that stuff", "stuff" );

            expect( error.httpResponseCode ).to.equal( 403 );
            expect( error.message ).to.be.a("string" );
            expect( error.resource ).to.be.a("string" );
        } );
    } );
    describe( 'AlUnimplementedMethodError', () => {
        test( 'should instantiate as expected', () => {
            const error = new AlUnimplementedMethodError( "No way, Jose" );

            expect( error.httpResponseCode ).to.equal( 501 );
            expect( error.message ).to.be.a("string" );
        } );
    } );
    describe( 'AlNotFoundError', () => {
        test( 'should instantiate as expected', () => {
            const error = new AlNotFoundError( "I don't think so, Bob" );

            expect( error.httpResponseCode ).to.equal( 404 );
            expect( error.message ).to.be.a("string" );
        } );
    } );

    describe( `AlBadGatewayError`, () => {
        test( 'should instantiate as expected', () => {
            const error = new AlBadGatewayError( "Sorry, Bob, someone else messed up.", "AIMS", { anything: true } );
            expect( error.httpResponseCode ).to.equal( 502 );
            expect( error.message ).to.be.a("string");
        } );
    } );

} );
