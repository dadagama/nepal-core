import { expect, describe, test, beforeEach, vi } from 'vitest';
import {
    AlTrigger,
    AlTriggeredEvent,
    AlTriggerStream,
} from '@al/core';

@AlTrigger("EventType1")
class EventType1 extends AlTriggeredEvent<boolean|string|number>
{
    constructor( public eventProperty:string = "default" ) {
        super();
    }
}

let handlerCallCount = 0;
const emptyHandler = ( event:AlTriggeredEvent<boolean|string|number> ) => { handlerCallCount++; };

describe( 'AlTriggerStream', () => {

    beforeEach( () => {
        handlerCallCount = 0;
    } );

    test("should initialize with expected state", () => {

        const stream = new AlTriggerStream();

        expect( stream.flowing ).to.equal( true );
        expect( stream.items ).to.eql( {} );
        expect( stream.captured.length ).to.equal( 0 );
        expect( stream.downstream ).to.equal( null );
        expect( stream.subscriptionCount ).to.equal( 0 );
    } );

    test("should allow 'bottled' initialization", () => {
        const stream = new AlTriggerStream( false );

        let subscription = stream.attach( EventType1, emptyHandler );

        stream.trigger( new EventType1() );

        expect( handlerCallCount ).to.equal( 0 );
        expect( stream.captured.length ).to.equal( 1 );
        expect( stream.flowing ).to.equal( false );

        subscription.cancel();
    } );

    test("should allow one stream to siphon the events from another stream", () => {
        const stream = new AlTriggerStream( false );

        let subscription = stream.attach( EventType1, emptyHandler );

        stream.trigger( new EventType1() );

        const stream2 = new AlTriggerStream();

        let subscription2 = stream2.attach( EventType1, emptyHandler );

        stream2.siphon( stream );

        expect( stream.downstream ).to.equal( stream2 );        //  events from stream flow into stream2
        expect( stream.subscriptionCount ).to.equal( 1 );
        expect( stream2.subscriptionCount ).to.equal( 1 );
        expect( handlerCallCount ).to.equal( 2 );

        subscription.cancel();
        subscription2.cancel();
    } );

    test("should respect pause, resume, and filter on subscriptions", () => {
        const stream = new AlTriggerStream();

        const subscription = stream.attach( EventType1, ( event ) => {
            handlerCallCount++;
        } );

        stream.trigger( new EventType1() );   //  This should be received

        subscription.pause();

        stream.trigger( new EventType1() );   //  This should NOT be received

        subscription.resume();

        stream.trigger( new EventType1() );   //  This should be received again

        expect( handlerCallCount ).to.equal( 2 );

        subscription.filter( ( event:any ) => event.eventProperty === 'good' );

        stream.trigger( new EventType1( "good" ) );   //  This should be received because it matches the filter

        expect( handlerCallCount ).to.equal( 3 );

        stream.trigger( new EventType1( "bad" ) );   //  This should NOT be received because it does not match the filter

        expect( handlerCallCount ).to.equal( 3 );

        subscription.cancel();

        stream.trigger( new EventType1( "good" ) );   //  This should NOT be received because we are no longer subscribed

        expect( handlerCallCount ).to.equal( 3 );

    } );

} );
