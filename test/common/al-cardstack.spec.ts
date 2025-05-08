import { expect, describe, vi, test, beforeEach } from 'vitest';
import {
    AlCardstackCharacteristics,
    AlCardstackView,
} from '@al/core';

const dummyColors = [
    {
        value: "red",
        caption: "Red"
    },
    {
        value: "green",
        caption: "Green"
    },
    {
        value: "blue",
        caption: "Blue"
    },
    {
        value: "purple",
        caption: "Purplepink"
    },
    {
        value: "deep_black",
        caption: "Infinite Night"
    }
];

const dummyShapes = [
    {
        value: "291AA850-D2DD-4654-8FFC-F7F58C632E3A",
        caption: "Flat"
    },
    {
        value: "D7F55EC3-7C96-43DB-8CDD-93E6F73056BD",
        caption: "Short"
    },
    {
        value: "35F26B47-3874-4EDB-B652-5477E106701B",
        caption: "Round"
    },
    {
        value: "0CD649EA-9957-486C-80D1-B2369AE61AEC",
        caption: "Rotund"
    },
    {
        value: "FFB41233-CFE7-4CF1-B3B3-955C0E823ED8",
        caption: "Obese"
    },
    {
        value: "0C939A6A-A2D7-4372-A163-FCA3593B126A",
        caption: "Dodecahedral"
    },
    {
        value: "291D2048-9100-4F3F-B56B-96965684ECAD",
        caption: "Extradimensional"
    }
];

const dummyCharacteristics:unknown = {
    entity: {
        domain: "dummy_service",
        caption: "Dummy",
        captionPlural: "Dummies"
    },

    sortableBy: [ "date_created", "color", "size" ],

    filterableBy: [ "color", "shape", "category" ],

    searchableBy: [ "category" ],

    groupableBy: [],

    definitions: {
        "date_created": {
            property: "date_created",
            caption: "Date Created"
        },
        "size": {
            property: "size",
            caption: "Size"
        },
        "color": {
            property: "color",
            caption: "Color",
            values: dummyColors
        },
        "shape" : {
            property: "shape",
            caption: "Shape",
            autoIndex: true
        },
        "category": {
            property: "category",
            caption: "Category"
        },
        "remote_data_id": {
            property: "remote_data_id",
            caption: "Remote Data ID blah blah blah",
            remote: true
        }
    },

    autoAggregate: true,
    hideEmptyFilterValues: true
};

export class DummyModel
{
    entityId:string;
    displayName:string;
    colorId:string;
    shapeId:string;
    created: {
        by:string;
        at:number;
    };
    unit_count:number;

    constructor() {
    }
}

export interface DummyProperties
{
    id:string;
    caption:string;
    color:string;
    shape:string;
    date_created:number;
    size:number;
    category:string;
}

export class DummyCardstack extends AlCardstackView<DummyModel,DummyProperties>
{
    public count:number = 0;
    constructor( cod:boolean = true ) {
        super( cod ? dummyCharacteristics as AlCardstackCharacteristics : undefined );
    }

    oneOf( list:any[] ):any {
        return list[Math.floor( Math.random() * list.length )];
    }

    async fetchData( initial, remoteFilters ) {
        let results:DummyModel[] = [];
        for ( let i = 0; i < 20; i++ ) {
            this.count++;
            const color = this.oneOf( dummyColors );
            const shape = this.oneOf( dummyShapes );
            let model = new DummyModel();
            model.entityId = this.count.toString();
            model.displayName = `Dummy #${this.count}`;
            model.colorId = color.value;
            model.shapeId = shape.value;
            model.created = {
                by: "user 10101000101111",
                at: 1505672016 + Math.floor( Math.random() * 500000 )
            };
            model.unit_count = Math.floor( 1 + ( Math.random() * 9 ) );
            results.push( model );
        }
        this.remainingPages = 2;
        this.loadedPages++;
        return results;
    }

    async generateCharacteristics() {
        return dummyCharacteristics as AlCardstackCharacteristics;
    }

    deriveEntityProperties( entity ) {
        return {
            id: entity.entityId,
            caption: entity.displayName,
            color: entity.colorId,
            shape: entity.shapeId,
            date_created: entity.created.at,
            size: entity.unit_count,
            category: "sumpin"
        }
    }
}

describe( 'AlCardstackView', () => {

    describe("`start()` method", () => {
        test( 'should call generateCharacteristics if no characteristics are provided to the constructor', async () => {
            let stack = new DummyCardstack( false );    //  no characteristics
            let spy = vi.spyOn( stack, 'generateCharacteristics' );
            await stack.start();
            expect( spy.mock.calls.length ).to.equal( 1 );
        } );
        test( 'should consume data as expected', async () => {

            let stack = new DummyCardstack();
            await stack.start();

            expect( stack.cards.length ).to.equal( 20 );
            expect( stack.loadedPages ).to.equal( 1 );

            await stack.continue();

            expect( stack.cards.length ).to.equal( 40 );
            expect( stack.loadedPages ).to.equal( 2 );

        } );
        test( 'should automatically populate values for properties with autoIndex enabled', async () => {
            let stack = new DummyCardstack();
            await stack.start();

            let shapeProperty = stack.getProperty("shape");
            expect( shapeProperty.values.length ).to.be.above( 0 );

            for ( let i = 0; i < stack.cards.length; i++ ) {
                let shapeValue = stack.cards[i].properties['shape'];
                let found = shapeProperty.values.find( vDescr => vDescr.value === shapeValue );
            }
        } );
    } );

    describe("utility method", () => {
        let stack:DummyCardstack = new DummyCardstack();
        beforeEach( async () => {
            await stack.start();
        } );

        test( '`getProperty()` should retrieve normalized property descriptor', () => {
            let date = stack.getProperty( "date_created" );
            expect( date ).to.be.an( 'object' );
            expect( date.property ).to.equal("date_created");
            expect( date.caption ).to.equal( "Date Created" );

            let color = stack.getProperty( "color" );
            expect( color ).to.be.an( 'object' );
            expect( color.property ).to.equal("color");
            expect( color.caption ).to.equal("Color");
            expect( color.values ).to.be.an( "array" );

            let color2 = stack.getProperty( color );
            expect( color ).to.equal( color2 );

            expect( () => {
                let fictional = stack.getProperty( "doesnt_exist" );
            } ).to.throw();
        } );

        test( '`getValue()` should always retrieve a reference to the normalized value descriptor', () => {
            let color = stack.getProperty( "color" );
            let purple = stack.getValue( color, "purple" );
            let purple2 = stack.getValue( "color", "purple" );
            let purple3 = stack.getValue( "color", purple );
            expect( purple ).to.equal( purple2 );
            expect( purple.property ).to.equal( color.property );
            expect( purple.value ).to.equal( "purple" );
            expect( purple.caption ).to.equal( "Purplepink" );
            expect( purple.valueKey ).to.equal( "color-purple" );
        } );
        test( '`getValue()` should throw when attempting to retrieve a value from a non-set property', () => {
            //  Make sure trying to get a value from a non-set property throws
            expect( () => {
                let noValues = stack.getValue( "size", 0 );
            } ).to.throw();

        } );
        test( '`getValue()` should throw when attempting to retrieve a value that does not exist', () => {
            //  Make sure trying to get a value that doesn't exist throws
            expect( () => {
                let fictional = stack.getValue( "color", "orangeyellow" );
            } ).to.throw();
        } );

    } );

    describe( '`applySortBy()`', () => {
        let stack:DummyCardstack;
        beforeEach( async () => {
            stack = new DummyCardstack();
            await stack.start();
        } );
        test( 'should sort numeric properties in the expected way', () => {
            let date = stack.getProperty( "date_created" );
            stack.applySortBy( date, 'asc' );
            let last = 0;
            for ( let i = 0; i < stack.cards.length; i++ ) {
                let card = stack.cards[i];
                expect( card.properties.date_created ).to.be.gte( last );
                last = card.properties.date_created;
            }

            stack.applySortBy( date, 'desc' );
            for ( let i = 0; i < stack.cards.length; i++ ) {
                let card = stack.cards[i];
                expect( card.properties.date_created ).to.be.lte( last );
                last = card.properties.date_created;
            }
        } );

    } );

    describe( '`applyFilterBy()`', () => {
        let stack:DummyCardstack;
        beforeEach( async () => {
            stack = new DummyCardstack();
            await stack.start();
        } );
        test( 'should show/hide items based on a single property.', () => {
            let firstCard = stack.cards[0];
            let color = stack.getValue( "color", firstCard.properties.color );
            stack.applyFilterBy( color );
            stack.applyFiltersAndSearch();
            for ( let i = 0; i < stack.cards.length; i++ ) {
                let card = stack.cards[i];
                if ( typeof( card.properties.color ) === 'undefined' ) {
                    expect( card.visible ).to.equal( false );
                } else if ( card.properties.color === firstCard.properties.color ) {
                    expect( card.visible ).to.equal( true );
                } else {
                    expect( card.visible ).to.equal( false );
                }
            }
        } );
        test( 'should restore visibility if a filter is removed', () => {
            let firstCard = stack.cards[0];
            let color = stack.getValue( "color", firstCard.properties.color );
            stack.applyFilterBy( color );
            stack.applyFiltersAndSearch();
            stack.removeFilterBy( color );
            for ( let i = 0; i < stack.cards.length; i++ ) {
                let card = stack.cards[i];
                expect( card.visible ).to.equal( true );
            }
        } );
        test( 'should show/hide items based on a single property/multiple values.', () => {
            for ( let i = 0; i < dummyColors.length; i++ ) {
                stack.applyFilterBy( stack.getValue( "color", dummyColors[i].value ) );
                expect( stack.activeFilters.length ).to.equal( 1 );
            }
            for ( let i = 0; i < stack.cards.length; i++ ) {
                let card = stack.cards[i];
                if ( typeof( card.properties.color ) === 'undefined' ) {
                    expect( card.visible ).to.equal( false );
                } else {
                    expect( card.visible ).to.equal( true );
                }
            }
            for ( let i = 0; i < dummyColors.length; i++ ) {
                stack.removeFilterBy( stack.getValue( "color", dummyColors[i].value ) );
            }
            expect( stack.activeFilters.length ).to.equal( 0 );      //  active filters should be empied when all values are removed
        } );
        test( 'should show/hide items based on a custom filter', () => {
            let firstCard = stack.cards[0];
            let color = stack.getValue( "color", firstCard.properties.color );
            stack.applyFilterBy( color, false, ( e, p, f ) => false );
            for ( let i = 0; i < stack.cards.length; i++ ) {
                let card = stack.cards[i];
                expect( card.visible ).to.equal( false );
            }
            stack.removeFilterBy( color );
            for ( let i = 0; i < stack.cards.length; i++ ) {
                let card = stack.cards[i];
                expect( card.visible ).to.equal( true );
            }
        } );

    } );

} );

