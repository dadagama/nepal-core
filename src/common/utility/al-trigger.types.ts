/**
 *  Author: Kevin Nielsen <knielsen@alertlogic.com>
 *  Copyright 2019 Alert Logic, Inc.
 */

import { isPromiseLike } from './is-promise-like';

/**
 *  @public
 *
 *  Annotation for trigger type classes.  Prevents unique event type names from being lost during minification/uglification.
 */
/* tslint:disable:function-name */
export function AlTrigger( eventTypeName:string ) {
    return function( ctor:Function ) {
        ctor.prototype.eventTypeName = eventTypeName;
    };
}

/**
 * @public
 *
 * Represents a typed event.
 */
export abstract class AlTriggeredEvent<ResponseType=any>
{
    constructor( syntheticName?:string ) {
        ( this as any ).eventTypeName = syntheticName || this.constructor.prototype.eventTypeName;
    }
}

/**
 * @public
 *
 * Callback type for triggered events.
 */
export declare type AlTriggeredEventCallback<EventType> = {(event:EventType):void|boolean|Promise<void>};

/**
 * @public
 *
 * Represents a subscription to a stream of triggered events.
 */
export class AlTriggerSubscription<EventType>
{
    protected active = true;
    protected filterCb:AlTriggeredEventCallback<EventType>|null = null;

    constructor( public stream:AlTriggerStream,
                 public eventType:string,
                 public listenerId:string,
                 public triggerCallback?:AlTriggeredEventCallback<EventType> ) {
    }

    then( cb:AlTriggeredEventCallback<any> ):AlTriggerSubscription<EventType> {
        this.triggerCallback = cb;
        return this;
    }

    filter( cb:AlTriggeredEventCallback<any> ):AlTriggerSubscription<EventType> {
        this.filterCb = cb;
        return this;
    }

    trigger( event:EventType ):void|boolean|Promise<void> {
        if ( this.active && this.triggerCallback ) {
            if ( this.filterCb === null || this.filterCb( event ) ) {
                return this.triggerCallback( event );
            }
        }
    }

    pause() {
        this.active = false;
    }

    resume() {
        this.active = true;
    }

    cancel() {
        this.stream.detach( this );
    }
}

/**
 * @public
 *
 * Represents a series of triggered events.
 */
export class AlTriggerStream
{
    items:{[triggeResponseType:string]:{[subscriptionId:string]:AlTriggerSubscription<any>}} = {};
    subscriptionCount:number            =   0;
    downstream:AlTriggerStream|null     =   null;
    flowing:boolean                     =   false;
    captured:AlTriggeredEvent<any>[]    =   [];

    constructor( flow:boolean = true ) {
        this.flowing = flow;
    }

    public getBucket( eventTypeName:string ) {
        if ( ! this.items.hasOwnProperty( eventTypeName ) ) {
            this.items[eventTypeName] = {};
        }
        return this.items[eventTypeName];
    }

    public attach<EventType extends AlTriggeredEvent>( eventType:string|Function, callback:AlTriggeredEventCallback<EventType>, subscriptionGroup?:AlSubscriptionGroup ):AlTriggerSubscription<EventType> {
        const eventTypeName = typeof( eventType ) === 'string' ? eventType : eventType.prototype.eventTypeName;
        const listenerId:string = `sub_${++this.subscriptionCount}`;
        const bucket = this.getBucket( eventTypeName );
        const subscription = new AlTriggerSubscription<EventType>( this, eventTypeName, listenerId, callback );
        bucket[listenerId] = subscription;
        if ( subscriptionGroup ) {
            subscriptionGroup.manage( subscription );
        }
        return subscription;
    }

    public detach( subscription:AlTriggerSubscription<any> ) {
        if ( this.items.hasOwnProperty( subscription.eventType ) && this.items[subscription.eventType].hasOwnProperty( subscription.listenerId ) ) {
            delete this.items[subscription.eventType][subscription.listenerId];
        }
    }

    public siphon( child:AlTriggerStream ) {
        child.downstream = this;
        child.tap();
    }

    public async trigger<EventType extends AlTriggeredEvent>( event:EventType ):Promise<EventType> {
        let eventType = ( event as any ).eventTypeName ?? 'unknown';
        if ( ! this.flowing ) {
            this.captured.push( event );
            return event;
        }
        let promises:PromiseLike<any>[] = [];

        Object.values( this.getBucket( eventType ) )
                        .forEach( subscription => {
                                    try {
                                        const result = subscription.trigger( event );
                                        if ( isPromiseLike( result ) ) {
                                            promises.push( result );
                                        }
                                    } catch( e ) {
                                        console.warn(`Trigger callback for event ${(event as any).eventTypeName} threw exception`, e );
                                    }
                                } );

        if ( promises.length ) {
            try {
                await Promise.allSettled( promises );
            } catch( e ) {}
        }

        return this.downstream ? this.downstream.trigger( event ) : event;
    }

    public tap() {
        this.flowing = true;
        while( this.captured.length > 0 ) {
            const event = this.captured.shift();
            if(event) {
                this.trigger( event );
            }
        }
    }
}

/**
 * @public
 *
 * This is a simple utility to manage a list of subscriptions, which may be AlTriggerSubscriptions or RxJS subscriptions.
 * It exposes a method `manage` to add new subscriptions, and a method `cancelAll` to unsubscribe from all subscriptions.
 * That is all it does.
 */
export class AlSubscriptionGroup
{
    subscriptions:any[] = [];

    constructor( ...items:any[] ) {
        this.manage( ...items );
    }

    /**
     * Adds one or more subscriptions (as themselves, in arrays, via callback function, or some mixture of these inputs)
     * to the internal list of managed items.
     */
    public manage( ...items:any[] ) {
        items.forEach( item => {
            if ( typeof( item ) === 'object' && item !== null && item.hasOwnProperty( "length" ) ) {
                item.map( (subitem: any) => this.manage( subitem ) );
            } else if ( typeof( item ) === 'function' ) {
                this.manage( item() );
            } else if ( item ) {
                this.subscriptions.push( item );
            }
        } );
    }

    /**
     * Cancels/unsubscribes from all subscriptions.
     */
    public cancelAll() {
        this.subscriptions.map( subscription => {
            if ( typeof( subscription.cancel ) === 'function' ) {
                subscription.cancel();
            } else if ( typeof( subscription.unsubscribe ) === 'function' ) {
                subscription.unsubscribe();
            }
        } );
        this.subscriptions = [];
    }
}

export class AlEventStream {
    public events = new AlTriggerStream();

    public async dispatch<EventType extends AlTriggeredEvent>( event:EventType ) {
        return this.events.trigger( event );
    }

    public on<EventType extends AlTriggeredEvent>( eventType:Function, callback:AlTriggeredEventCallback<EventType> ):AlTriggerSubscription<EventType> {
        return this.events.attach( eventType, callback );
    }
}
