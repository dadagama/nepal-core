import { expect, describe, test, afterEach, beforeEach, vi } from 'vitest';
import { AlStopwatch } from '@al/core';

describe( 'AlStopwatch', () => {

    let stopwatch:AlStopwatch;
    let callCount:number = 0;
    const callback = () => {
        callCount++;
    };

    beforeEach( () => {
        callCount = 0;
    } );

    afterEach( () => {
        afterEach( () => vi.restoreAllMocks() );
    } );

    test("should instantiate via `later`", () => {
        stopwatch = AlStopwatch.later( callback );
        expect( stopwatch.callback ).to.equal( callback );
        expect( stopwatch.timer ).to.equal( null );
        expect( stopwatch.interval ).to.equal( 0 );
    } );

    test("should instantiate via `once`", async () => {
        stopwatch = AlStopwatch.once( callback, 100 );
        expect( stopwatch.callback ).to.equal( callback );
        expect( stopwatch.timer ).not.to.equal( null );
        expect( stopwatch.interval ).to.equal( 0 );
    } );

    test("should instantiate via `repeatedly` WITHOUT immediate executation", async () => {
        return new Promise( ( resolve, reject ) => {
            stopwatch = AlStopwatch.repeatedly( callback, 100, false );
            expect( stopwatch.callback ).to.equal( callback );
            expect( stopwatch.timer ).not.to.equal( null );
            expect( stopwatch.interval ).to.equal( 100 );

            setTimeout( () => {
                //                expect( callCount ).to.equal( 2 );      //  100ms and 200ms

                //  Validate cancelation works as expected
                stopwatch.cancel();
                expect( stopwatch.timer ).to.equal( null );

                resolve();
            }, 250 );

        } );
    } );

    test("should instantiate via `repeatedly` WITH immediate executation", async () => {
        return new Promise( ( resolve, reject ) => {
            stopwatch = AlStopwatch.repeatedly( callback, 100, true );
            expect( stopwatch.callback ).to.equal( callback );
            expect( stopwatch.timer ).not.to.equal( null );
            expect( stopwatch.interval ).to.equal( 100 );

            setTimeout( () => {
                //  expect( callCount ).to.equal( 3 );      //  0ms, 100ms, and 200ms
                resolve();
            }, 250 );

        } );
    } );

    test("should instantiate and resolve via `promise()`", async () => {
        let promise = AlStopwatch.promise( 100 );
        let executed:boolean = false;
        promise.then( () => executed = true );
        await promise;
        expect( executed ).to.equal( true );
    } );

    describe( "`.again()`", async () => {
        test( "should not create a new timer if one already exists", () => {
            stopwatch = AlStopwatch.repeatedly( callback, 10000 );
            const originalTimer = stopwatch.timer;
            expect( stopwatch.interval ).to.equal( 10000 );
            stopwatch.again( 0 );
            expect( stopwatch.timer ).to.equal( originalTimer );
            expect( stopwatch.interval ).to.equal( 10000 );
        } );
    } );

    describe( "`.reschedule()`", async () => {
        test( "should call `cancel` and `again`", async () => {
            stopwatch = AlStopwatch.later( callback );
            let cancel = vi.spyOn( stopwatch, "cancel" );
            let again = vi.spyOn( stopwatch, "again" );
            stopwatch.reschedule( 10000 );
            expect( cancel.mock.calls.length ).to.equal( 1 );
            expect( again.mock.calls.length ).to.equal( 1 );
            expect( again.mock.calls[0][0] ).to.equal( 10000 );
        } );

        test( "should default to immediate reexecution", async () => {
            stopwatch = AlStopwatch.later( callback );
            let again = vi.spyOn( stopwatch, "again" );
            stopwatch.reschedule();
            expect( again.mock.calls.length ).to.equal( 1 );
            expect( again.mock.calls[0][0] ).to.equal( 0 );
        } );
    } );

    describe( "`.reschedule()`", async () => {
        test( "should call `cancel` and `again`", async () => {
            stopwatch = AlStopwatch.later( callback );
            let tick = vi.spyOn( stopwatch, "tick" );
            stopwatch.now();
            expect( tick.mock.calls.length ).to.equal( 1 );
            expect( callCount ).to.equal( 1 );
        } );
    } );

} );
