import { expect, describe, test, afterEach, vi } from 'vitest';
import { isPromiseLike } from '@al/core';

test( `isPromiseLike`, () => {
    describe( `should differentiate between promise-y and non-promise-y things`, () => {
        let testObjects = [
            "kevin",
            { then: true },
            { then: () => {} },
            { then: { not_a_function: true } }
        ];
        let testResults = testObjects.map( thing => isPromiseLike( thing ) );
        expect( testResults ).to.deep.equal( [ false, false, true, false ] );
    } );
} );

