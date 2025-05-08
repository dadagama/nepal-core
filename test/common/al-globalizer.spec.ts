import { expect, describe, test, vi, beforeEach, afterEach } from 'vitest';
import { AlGlobalizer } from '@al/core';
import { JSDOM } from 'jsdom';

describe( `AlGlobalizer`, () => {
    describe( `.expose()`, () => {
        test("should put a known object into a known place", () => {
            let myThing = {
                version: 1,
                thingy: true
            };
            AlGlobalizer.expose( "some.named.path", myThing );
        } );
    } );

    describe( `.instantiate()`, () => {
        beforeEach( () => {
            const dom = new JSDOM( `<DOCTYPE html><body></body>`);
            vi.stubGlobal( "window", dom.window );
        } );
        afterEach( () => {
            vi.restoreAllMocks();
            vi.unstubAllGlobals();
        } );
        test( "should use a factory method to create an instance of a service", () => {
            AlGlobalizer.instantiate<any>( "kevin", () => { return { something: true }; } );
            expect( (window as any).al.registry.kevin ).toBeDefined();
        } );
        test( "should warn about collisions when collisionHandling is set to true", () => {
            let stub = vi.spyOn( console, 'warn' ).mockReturnValue( null );
            AlGlobalizer.instantiate<any>( "kevin2", () => true, true );
            AlGlobalizer.instantiate<any>( "kevin2", () => true, true );
            expect( stub.mock.calls.length ).to.equal( 1 );
        } );
        test( "should throw an error when collisionHandling is a string", () => {
            AlGlobalizer.instantiate<any>( "kevin3", () => true, "Something is horribly wrong" );
            try {
                AlGlobalizer.instantiate<any>( "kevin3", () => true, "Something is horribly wrong" )
                expect( true ).to.equal( false );
            } catch( e ) {
                expect( e ).to.be.an( "Error" );
            }
        } );
        test( "should return the original object when collisionHandling is false", () => {
            AlGlobalizer.instantiate<any>( "kevin4", () => true, false );
            let instance = AlGlobalizer.instantiate<any>( "kevin4", () => false, false );
            expect( instance ).to.equal( true );        //  should retain first value
        } );
    } );
} );

