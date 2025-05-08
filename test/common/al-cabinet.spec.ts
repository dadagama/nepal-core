import { expect, describe, test, beforeEach } from 'vitest';
import { AlCabinet } from '@al/core';

test( 'AlCabinet', () => {

    beforeEach( () => {
    } );

    describe('static methods', () => {
        it('should instantiate an AlCabinet of the correct type', () => {
            const p = AlCabinet.persistent( "cabinet" );
            expect( p.type ).toBe( AlCabinet.PERSISTENT );
            expect( p.data ).to.eql( {} );
            expect( p.name ).toBe( "cabinet_persistent" );

            const e = AlCabinet.ephemeral( "cabinet" );
            expect( e.type ).toBe( AlCabinet.EPHEMERAL );
            expect( e.data ).to.eql( {} );
            expect( e.name ).toBe( "cabinet_ephemeral" );

            const l = AlCabinet.local( "cabinet" );
            expect( l.type ).toBe( AlCabinet.LOCAL );
            expect( l.data ).to.eql( {} );
            expect( l.name ).toBe( "cabinet" );
        } );

        it( 'should always return a reference to the same cabinet for a given name', () => {
            const p = AlCabinet.persistent("test1" );
            const ref2 = AlCabinet.persistent("test1" );

            expect( p ).toBe( ref2 );
        } );
    } );

    describe('accessor methods', () => {
        it('should allow get, set, and delete of named keys', () => {
            const cabinet = AlCabinet.local( "test" );

            expect( cabinet.get("value") ).toBe( null );

            cabinet.set("value", true );
            cabinet.set("value2", { name: "Kevin", identity: "dumb" } );

            expect( cabinet.get("value" ) ).toBe( true );
            expect( cabinet.exists("value" ) ).toBe( true );

            cabinet.delete( "value" );
            expect( cabinet.get("value" ) ).toBe( null );
            expect( cabinet.exists("value" ) ).toBe( false );

            //  Verify default value override works
            expect( cabinet.get("doesnt_exist", "exists" ) ).toBe( "exists" );

            //  Verify that set/undefined is the same as deletion
            cabinet.set("value2", undefined );
            expect( cabinet.exists("value2" ) ).toBe( false );
            expect( cabinet.get("value2", null ) ).toBe( null );
        } );

        it('should delete expired content', ( done ) => {
            const cabinet = AlCabinet.local("test2" );
            cabinet.set("value1", true, 0.01 );     //  1 centisecond lifespan
            cabinet.set("value2", true, 1 );        //  1 second lifespan
            setTimeout( () => {
                expect( cabinet.expired( "value0" ) ).toBe( true );

                expect( cabinet.expired( "value1" ) ).toBe( true );
                expect( cabinet.get("value1", false ) ).toBe( false );
                expect( cabinet.exists("value1" ) ).toBe( false );

                expect( cabinet.expired( "value2" ) ).toBe( false );
                expect( cabinet.get("value2", false ) ).toBe( true );
                expect( cabinet.exists("value2" ) ).toBe( true );
                done();
            }, 50 );
        } );
    } );

    describe('synchronize and destroy methods', () => {
        it("should synchronize and destroy (ALLTHETHINGS)", () => {
            const scabinet = AlCabinet.ephemeral("testDestroySS" );
            const lcabinet = AlCabinet.persistent("testDestroyLS" );

            scabinet.set("item", { value: true, something: "else" } );
            lcabinet.set("item", { value: true, something: "else" } );

            scabinet.synchronize();
            lcabinet.synchronize();

            expect( localStorage.getItem("testDestroyLS_persistent") ).to.be.a('string' );
            expect( sessionStorage.getItem("testDestroySS_ephemeral") ).to.be.a('string' );

            scabinet.destroy();
            lcabinet.destroy();

            expect( sessionStorage.getItem("testDestroySS") ).toBe( null );
            expect( localStorage.getItem("testDestroyLS") ).toBe( null );
        } );
    } );

} );
