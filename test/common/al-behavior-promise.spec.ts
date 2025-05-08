import { describe, expect, test, beforeEach, vi } from 'vitest';
import { AlBehaviorPromise } from '@al/core';

describe( 'AlBehaviorPromise', () => {

    let behavior = new AlBehaviorPromise<number>();
    let results:any = {};
    let resolver1 = ( value:number ) => { results.resolver1 = value; };
    let resolver2 = ( value:number ) => { results.resolver2 = value; };
    let resolver3 = ( value:number ) => { results.resolver3 = value; };
    let rejector = ( reason:string ) => { results.rejected = true; results.rejectionReason = reason; };

    beforeEach( () => {
        results = {
            resolver1: null,
            resolver2: null,
            resolver3: null,
            rejected: false,
            rejectionReason: null
        };
    } );

    test( 'should be in an unfulfilled state after construction', async () => {
        expect( behavior['promise'] ).to.be.an.instanceOf( Promise );
        expect( behavior.isFulfilled() ).to.equal( false );
        expect( behavior.getValue() ).to.equal( null );
    } );

    test( 'should automatically fulfill if provided an initial value', async () => {
        behavior = new AlBehaviorPromise(42);
        expect( behavior['promise'] ).to.be.an.instanceOf( Promise );
        expect( behavior.isFulfilled() ).to.equal( true );
        expect( behavior.getValue() ).to.equal( 42 );
    } );

    test( 'should handle resolution and change to a fulfilled state', async () => {
        behavior.then( resolver1 );
        await behavior.resolve( 42 );
        expect( behavior.isFulfilled() ).to.equal( true );
        expect( behavior.getValue() ).to.equal( 42 );
        expect( results.resolver1 ).to.equal( 42 );
    } );

    test( 'should handle successive resolutions and stay in a fulfilled state with the last value', async () => {
        behavior.then( resolver1 );     //  subscribe
        await behavior.resolve( 42 );   //  received by resolver1
        await behavior.resolve( 64 );   //  change value
        behavior.then( resolver2 );     //  received by resolver2 with 64
        behavior.then( resolver3 );     //  received by resolver3 with 64
        await behavior.resolve( 91 );   //  nobody will receive this value, but wth
        expect( behavior.isFulfilled() ).to.equal( true );
        expect( behavior.getValue() ).to.equal( 91 );
        expect( results.resolver1 ).to.equal( 42 );
        expect( results.resolver2 ).to.equal( 64 );
        expect( results.resolver3 ).to.equal( 64 );
    } );

    test( "should correctly handle being 'rescinded'", async () => {
        /* test else */
        behavior = new AlBehaviorPromise();
        behavior.rescind();

        behavior = new AlBehaviorPromise( 10000 );
        behavior.rescind();             //  this should put the promise back into "unfulfilled" state

        expect( behavior.isFulfilled() ).to.equal( false );
        expect( behavior.getValue() ).to.equal( null );

        behavior.then( resolver2 );

        expect( results.resolver2 ).to.equal( null );       //  no resolution yet

        behavior.then( resolver3 );
        await behavior.resolve( 16 );   //  Now, everything should be back to fulfilled again, and resolver2 and resolver3 should have received value "16"

        expect( results.resolver2 ).to.equal( 16 );
        expect( results.resolver3 ).to.equal( 16 );
        expect( behavior.isFulfilled() ).to.equal( true );
        expect( behavior.getValue() ).to.equal( 16 );

    } );

    /*
     * This should be achievable using the expect form `await expect( code() ).rejects.toThrow()`, but I'm missing something.
     */
    test.skip( "should correctly handle being 'rejected'", async () => {
        behavior = new AlBehaviorPromise();
        try {
            behavior.then( resolver1 );
            behavior.reject("Something gun wrong.");
            expect( true ).to.equal( false );       //  should never get here
        } catch( e ) {
            expect( behavior.isFulfilled() ).to.equal( true );
        }

        behavior = new AlBehaviorPromise();
        try {
            behavior.then( resolver1, rejector );
            behavior.reject( "Something broked." );
            expect( true ).to.equal( false );       //  should never get here
        } catch( e ) {
            expect( results.rejected ).to.equal( true );
            expect( results.rejectionReason ).to.equal( "Something broked." );
        }
    } );

} );
