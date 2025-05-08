import { expect, describe, test, beforeEach, afterEach, vi } from 'vitest';
import xhrMock, { once } from 'xhr-mock';
import {
    AlLocation,
    AlLocatorService,
    AlCabinet,
    AlDefaultClient,
    APIRequestParams
} from "@al/core";

const defaultAuthResponse = {
  authentication: {
    user: {
      id: '715A4EC0-9833-4D6E-9C03-A537E3F98D23',
      name: 'Bob Dobalina',
      email: 'bob@company.com',
      active: true,
      locked: false,
      version: 1,
      created: {
        at: 1430183768,
        by: 'System',
      },
      modified: {
        at: 1430183768,
        by: 'System',
      },
    },
    account: {
      id: '12345678',
      name: 'Company Name',
      active: true,
      version: 1,
      accessible_locations: ['insight-us-virginia'],
      default_location: 'insight-us-virginia',
      created: {
        by: 'system',
        at: 1436482061,
      },
      modified: {
        by: 'system',
        at: 1436482061,
      },
    },
    token: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9==.QKRHma5zAOdhU50ZE4ryPxVpvKt0A0gbjY62xHCWm8s=',
    token_expiration: + new Date() + 1000,
  },
};

/**
 * Set up endpoint dictionary
 */
function configureCache( client:any ) {
    client['endpointCache'] = {
        'integration': {
            "0": {
                "cargo": { "default": "https://api.global-integration.product.dev.alertlogic.com" },
                "kevin": { "default" : "https://kevin.product.dev.alertlogic.com" },
                "search": { "default" : "https://api.global-fake-integration.product.dev.alertlogic.com" },
                "aims": { "default" : "https://api.global-integration.product.dev.alertlogic.com" }
            },
            "2": {
                "cargo": { "default": "https://api.global-integration.product.dev.alertlogic.com" },
                "kevin": { "default" : "https://kevin.product.dev.alertlogic.com" },
                "search": { "default" : "https://api.global-fake-integration.product.dev.alertlogic.com" },
                "aims": { "default" : "https://api.global-integration.product.dev.alertlogic.com" }
            },
            "3": {
              "cargo": { "default" : "https://api.global-integration.product.dev.alertlogic.com" },
              "kevin": { "default" : "https://kevin.product.dev.alertlogic.co.uk" }
            },
            "67108880": {
                "cargo": { "default": "https://api.global-integration.product.dev.alertlogic.com" },
                "kevin": { "default" : "https://kevin.product.dev.alertlogic.com" },
                "search": { "default" : "https://api.global-fake-integration.product.dev.alertlogic.com" },
                "aims": { "default" : "https://api.global-integration.product.dev.alertlogic.com" }
            },
            "12345678": {
                "iris": {
                    "EMEA": "https://rob.product.dev.alertlogic.co.uk"
                },
                "responder": {
                    "EMEA": "https://responder.mdr.product.dev.something.alertlogic.com",
                    "US": "https://responder.mdr.product.dev.something.alertlogic.co.uk",
                    "default": "https://responder.mdr.product.dev.something.alertlogic.com"
                }
            }
        }
    };
}

describe.skip("AlDefaultClient", () => {

    beforeEach(() => {
        xhrMock.setup();
        AlLocatorService.setContext( { environment: "integration", residency: 'EMEA', insightLocationId: 'defender-uk-newport' } );      //  for unit tests, assume integration environment
        configureCache( AlDefaultClient );
    } );
    afterEach(() => {
      xhrMock.teardown();
      AlDefaultClient.reset();
    });

    describe('merge function', () => {
        test('should merge objects reliably', () => {
            let source1 = {
                a: true,
                b: 3,
                c: "kevin"
            };
            let source2 = {
                a: false,
                b: 4,
                c: "kermit"
            };
            let source3 = {
                b: -1,
                c: "miss piggy"
            };

            let target = AlDefaultClient['merge']( {}, source1 );
            expect( target ).to.deep.equal( source1 );

            target = AlDefaultClient['merge']( {}, source1, source2 );
            expect( target ).to.deep.equal( source2 );

            target = AlDefaultClient['merge']( {}, source1, source3, source2 );
            expect( target.a ).to.equal( false );
            expect( target.b ).to.equal( 4 );
            expect( target.c ).to.equal( "kermit" );
        } );
    } );

    describe('when calculating request URLs', () => {
      describe('with no params supplied', () => {
        test('should throw an error', async () => {
          let result = await AlDefaultClient['calculateRequestURL']( {} )
              .then( r => {
                expect( false ).to.equal( true );       //  this should never occur
              } ).catch( e => {
                expect(true).to.equal( true );
              } );
        } );
      });
      describe('with parameters', () => {
        test('should return targets with correct hosts and paths', async () => {

          let endpointURL = await AlDefaultClient['calculateRequestURL']({ service_name: 'cargo', service_stack: AlLocation.InsightAPI });
          // path should default to /:service_name/v1, no trailing slash
          expect(endpointURL).to.equal( "https://api.product.dev.alertlogic.com/cargo" );

          endpointURL = await AlDefaultClient['calculateRequestURL']( { service_name: 'aims', version: null, service_stack: AlLocation.InsightAPI } );
          expect(endpointURL).to.equal( "https://api.global-integration.product.dev.alertlogic.com/aims" );

          endpointURL = await AlDefaultClient['calculateRequestURL']( { service_name: 'aims', version: 'v4', service_stack: AlLocation.InsightAPI } );
          //  path should be /:service_name/:version, no trailing slash
          expect(endpointURL).to.equal( "https://api.global-integration.product.dev.alertlogic.com/aims/v4" );

          endpointURL = await AlDefaultClient['calculateRequestURL']( { service_name: 'cargo', version: 'v2', account_id: '67108880', service_stack: AlLocation.InsightAPI  } );
          //  path should be /:service_name/:version/:accountId, no trailing slash
          expect( endpointURL ).to.equal( `https://api.product.dev.alertlogic.com/cargo/v2/67108880` );

          endpointURL = await AlDefaultClient['calculateRequestURL']( { service_name: 'search', version: 'v1', path: 'global-capabilities', service_stack: AlLocation.InsightAPI  } );
          //  domain should be non-default; path should be /:service_name/:version/:path
          expect( endpointURL ).to.equal( `https://api.global-fake-integration.product.dev.alertlogic.com/search/v1/global-capabilities` );

          endpointURL = await AlDefaultClient['calculateRequestURL']( { service_name: 'aims', version: 'v100', account_id: '67108880', path: '/some/arbitrary/path/', service_stack: AlLocation.InsightAPI  } );
          //  path should be /:service_name/:version/:accountId, trailing slash ONLY because it is included in path, but no double slash from the slash at the beginning of `path`
          expect( endpointURL ).to.equal( "https://api.global-integration.product.dev.alertlogic.com/aims/v100/67108880/some/arbitrary/path/" );

          endpointURL = await AlDefaultClient['calculateRequestURL']( { service_name: 'search', version: 2, account_id: '2', path: '/some/endpoint', params: { a: 1, b: 2, c: 3 }, service_stack: AlLocation.InsightAPI  } );
          //  query params should not be applied by this stage -- axios serializes them and dispatches them during the actual request execution
          expect( endpointURL ).to.equal( "https://api.global-fake-integration.product.dev.alertlogic.com/search/v2/2/some/endpoint" );

          endpointURL = await AlDefaultClient['calculateRequestURL']( { service_name: 'kevin', version: 1, account_id: '67108880', path: '/some/endpoint', context_account_id: '3', service_stack: AlLocation.InsightAPI } );
          //  expect the endpoints response for the context_account_id to be used instead of the dominant account_id's
          expect( endpointURL ).to.equal( `https://kevin.product.dev.alertlogic.co.uk/kevin/v1/67108880/some/endpoint` );

          endpointURL = await AlDefaultClient['calculateRequestURL']( { service_name: 'cargo', target_endpoint: 'kevin', path: '/some/endpoint' } );
          //  expect target endpoint ID to be honored
          expect( endpointURL ).to.equal( `https://kevin.product.dev.alertlogic.com/cargo/some/endpoint` );

          endpointURL = await AlDefaultClient['calculateRequestURL']( { service_name: 'iris', version: 1, account_id: '12345678', path: '/some/endpoint', service_stack: AlLocation.InsightAPI  } );
          //  expect target endpoint to be referenced from residency based lookup
          expect( endpointURL ).to.equal( `https://rob.product.dev.alertlogic.co.uk/iris/v1/12345678/some/endpoint` );

          AlDefaultClient.defaultAccountId = "67108880";
          endpointURL = await AlDefaultClient['calculateRequestURL']( { service_name: 'kevin', version: 16, path: 'some/arbitrary/endpoint', service_stack: AlLocation.InsightAPI } );
          expect( endpointURL ).to.equal( `https://kevin.product.dev.alertlogic.com/kevin/v16/some/arbitrary/endpoint` );
          AlDefaultClient.defaultAccountId = null;


        });
      });
      describe.skip("using `target_endpoint` resolution", () => {
        test("should resolve correct url", async () => {
          xhrMock.post( 'https://api.global-integration.product.dev.alertlogic.com/endpoints/v1/10101010/residency/default/endpoints', once({
            status: 200,
            body: {"bryan": "api.bryan.alertlogic.com"}
          }) );
          let url = await AlDefaultClient['calculateRequestURL']( { target_endpoint: 'bryan', path: 'playbooks', version: 1, account_id: "10101010" } );
          expect( url ).to.equal( 'https://api.bryan.alertlogic.com/v1/10101010/playbooks' );
        } );
        test("should set wss protocol for async endpoints", async () => {
          xhrMock.post( 'https://api.global-integration.product.dev.alertlogic.com/endpoints/v1/10101010/residency/default/endpoints', once({
            status: 200,
            body: {"bryan": "async.bryan.alertlogic.com"}
          }) );
          let url = await AlDefaultClient['calculateRequestURL']( { target_endpoint: 'bryan', path: 'playbooks', version: 1, account_id: "10101010" } );
          expect( url ).to.equal( 'wss://async.bryan.alertlogic.com/v1/10101010/playbooks' );
        } );
      } );
      describe("and an exception is thrown from the `endpoints` service", () => {
        test("should fall back to default values", async () => {
          xhrMock.post( 'https://api.global-integration.product.dev.alertlogic.com/endpoints/v1/10101010/residency/default/endpoints', once({
            status: 500,
            body: 'Internal Error Or Something'
          }) );

          let url = await AlDefaultClient['calculateRequestURL']( { service_name: 'aims', version: 1, path: '/something', account_id: "10101010", service_stack: AlLocation.InsightAPI } );
          expect( url ).to.equal( 'https://api.product.dev.alertlogic.com/aims/v1/10101010/something' );
        } );
      } );
    });

    describe('When performing two fetch operations', () => {
      describe.skip(' with no TTL', () => {
        test('should return fresh data without caching', async () => {
          // Here we mock out a second response from back end...
          xhrMock.get('https://api.global-integration.product.dev.alertlogic.com/aims/v1/2/users', once({
            status: 200,
            body: 'first response',
          }));
          await AlDefaultClient.get({ service_name: 'aims', version: 'v1', account_id: '2', path: 'users' });                            //  fetch once
          xhrMock.get('https://api.global-integration.product.dev.alertlogic.com/aims/v1/2/users', once({
            status: 200,
            body: 'second response',
          }));
          let response = await AlDefaultClient.get({ service_name: 'aims', version: 'v1', account_id: '2', path: 'users'});     //  fetch again, TTL 0 to disable caching
          expect(response).to.equal('second response');
        });
      });
      describe('with caching enabled', () => {
        test('should return the first server response', async () => {
          xhrMock.get('https://api.global-integration.product.dev.alertlogic.com/aims/v1/2/users', once({
            status: 200,
            body: 'first response',
          }));
          await AlDefaultClient.get({ service_name: 'aims', version: 'v1', account_id: '2', path: 'users', ttl: true });
          xhrMock.get('https://api.global-integration.product.dev.alertlogic.com/aims/v1/2/users', once({
            status: 200,
            body: 'second response',
          }));
          let response = await AlDefaultClient.get({ service_name: 'aims', version: 'v1', account_id: '2', path: 'users', ttl: true });
          expect(response).to.equal('first response');
        });
      });
      describe('with caching enabled and the same query params supplied', () => {
        test('should return the first server response', async () => {
          xhrMock.get('https://api.global-integration.product.dev.alertlogic.com/aims/v1/2/users?foo=bar', once({
            status: 200,
            body: 'first response',
          }));
          await AlDefaultClient.get({ service_name: 'aims', version: 'v1', account_id: '2', path: 'users', params: {foo: 'bar'}, ttl: true });
          xhrMock.get('https://api.global-integration.product.dev.alertlogic.com/aims/v1/2/users?foo=bar', once({
            status: 200,
            body: 'second response',
          }));
          let response = await AlDefaultClient.get({ service_name: 'aims', version: 'v1', account_id: '2', path: 'users' , params: {foo: 'bar'}, ttl: true });
          expect(response).to.equal('first response');
        });
        describe('which contain an array of values', () => {
          test('should return the first server response', async () => {
            xhrMock.get('https://api.global-integration.product.dev.alertlogic.com/aims/v1/2/users?foo=bar&foo=meow', once({
              status: 200,
              body: 'first response',
            }));
            await AlDefaultClient.get({ service_name: 'aims', version: 'v1', account_id: '2', path: 'users', params: {foo: ['bar', 'meow']}, ttl: true });
            xhrMock.get('https://api.global-integration.product.dev.alertlogic.com/aims/v1/2/users?foo=bar&foo=meow', once({
              status: 200,
              body: 'second response',
            }));
            let response = await AlDefaultClient.get({ service_name: 'aims', version: 'v1', account_id: '2', path: 'users' , params: {foo: ['bar', 'meow']}, ttl: true });
            expect(response).to.equal('first response');
          });
        });
      });
      describe.skip('with caching enabled and different query params supplied', () => {
        test('should return the second server response', async () => {
          vi.spyOn( AlDefaultClient, `axiosRequest` )
                .mockImplementation( async ( req ) => {
                    console.log("IN MOCK IMPLEMENTATION" );
                    return { status: 200, body: "first response" };
                } );
/*                .mockResolvedValueOnce( { status: 200, body: "first response" } )
                .mockResolvedValueOnce( { status: 200, body: "second response" } );
                */
          let firstResponse = await AlDefaultClient.get({ service_name: 'aims', version: 'v1', account_id: '2', path: 'users', params: {foo: 'bar'}, ttl: true });
          let secondResponse = await AlDefaultClient.get({ service_name: 'aims', version: 'v1', account_id: '2', path: 'users' , params: {foo: 'baz'}, ttl: true });
          expect(secondResponse).to.equal('second response');
        });
      });
    });

    describe.skip('When authenticating a user with credentials', () => {
      const username = 'bob@email.com';
      const password = 'IAmNotAValidUser!@#$';
      const mfaCode = '123456';
      describe('but without supplying an mfa code', () => {
        test('should perform the authenticate request and set underlying session details using the response returned', async() => {
          xhrMock.post('https://api.global-integration.product.dev.alertlogic.com/aims/v1/authenticate', (req, res) => {
            expect(req.header('Authorization')).to.equal(`Basic ${btoa(unescape(encodeURIComponent(`${username}:${password}`)))}`);
            expect(req.body()).to.equal('{}');
            return res.status(200).body(defaultAuthResponse);
          });
          const sessionDescriptor = await AlDefaultClient.authenticate(username, password, undefined, true );
          expect( sessionDescriptor ).to.deep.equals( defaultAuthResponse );
        });
      });
      describe('and an mfa code supplied', () => {
        test('should perform the authenticate request and include an mfa_code request body parameter', async() => {
          xhrMock.post('https://api.global-integration.product.dev.alertlogic.com/aims/v1/authenticate', (req, res) => {
            expect(req.header('Authorization')).to.equal(`Basic ${btoa(unescape(encodeURIComponent(`${username}:${password}`)))}`);
            expect(JSON.parse(req.body())).to.deep.equals({mfa_code: mfaCode});
            return res.status(200).body(defaultAuthResponse);
          });
          const sessionDescriptor = await AlDefaultClient.authenticate(username, password, mfaCode, true );
          expect( sessionDescriptor ).to.deep.equals( defaultAuthResponse );
        });
      });
      describe('and with extra payload content', () => {
        test( 'should perform the authenticate request and include the extra payload content in the request body', async () => {
          xhrMock.post('https://api.global-integration.product.dev.alertlogic.com/aims/v1/authenticate', ( req, res ) => {
            expect(req.header('Authorization')).to.equal(`Basic ${btoa(unescape(encodeURIComponent(`${username}:${password}`)))}`);
            expect(JSON.parse(req.body())).to.deep.equals({ seen_stateramp_banner: true });
            return res.status(200).body(defaultAuthResponse);
          } );
          const sessionDescriptor = await AlDefaultClient.authenticate( username, password, undefined, true, { seen_stateramp_banner: true } );
          expect( sessionDescriptor ).to.deep.equals( defaultAuthResponse );
        } );
      } );
    });

    describe.skip('When authenticating a user with a session token and mfa code', () => {
      const sessionToken = 'Ses1ion.Tok3n==';
      const mfaCode = '123456';
      test('should perform the authenticate request using the session token as a header and mfa code as a body param', async() => {
        xhrMock.post('https://api.global-integration.product.dev.alertlogic.com/aims/v1/authenticate', (req, res) => {
          expect(req.header('X-AIMS-Session-Token')).to.equal(sessionToken);
          expect(JSON.parse(req.body())).to.deep.equals({ mfa_code: mfaCode });
          return res.status(200).body(defaultAuthResponse);
        });
        await AlDefaultClient.authenticateWithMFASessionToken(sessionToken, mfaCode, true );
      });
    });

    describe('retry logic', () => {
      test( 'should generate random cache breakers for every retry call', () => {
        let previousValues = [];
        for ( let i = 0; i < 100; i++ ) {
            let breaker = AlDefaultClient['generateCacheBuster']( Math.floor( Math.random() * 5 ) );      //    cache busters should be suitably random to avoid overlaps
            expect( previousValues.indexOf( breaker ) ).to.equal( -1 );
            previousValues.push( breaker );
        }
      } );
      test( 'should detect the difference between retryable and non-retryable errors', () => {
        const config:APIRequestParams = {
            retry_count: 10,
            url: "https://some.com/made/up/url"
        };
        expect( AlDefaultClient['isRetryableError']( { data: {}, status: 500, statusText: "Something", config: {}, headers: {} }, config, 0 ) ).to.equal( true );
        expect( AlDefaultClient['isRetryableError']( { data: {}, status: 503, statusText: "Something", config: {}, headers: {} }, config, 0  ) ).to.equal( true );
        expect( AlDefaultClient['isRetryableError']( { data: {}, status: 302, statusText: "Something", config: {}, headers: {} }, config, 0  ) ).to.equal( true );
        expect( AlDefaultClient['isRetryableError']( { data: {}, status: 0, statusText: "Something", config: {}, headers: {} }, config, 0  ) ).to.equal( true );
        expect( AlDefaultClient['isRetryableError']( { data: {}, status: 0, statusText: "Something", config: {}, headers: {} }, config, 10  ) ).to.equal( false );
        expect( AlDefaultClient['isRetryableError']( { data: {}, status: 204, statusText: "Something", config: {}, headers: {} }, config, 0  ) ).to.equal( false );
        expect( AlDefaultClient['isRetryableError']( { data: {}, status: 404, statusText: "Something", config: {}, headers: {} }, config, 0  ) ).to.equal( false );
        expect( AlDefaultClient['isRetryableError']( { data: {}, status: 403, statusText: "Something", config: {}, headers: {} }, config, 0  ) ).to.equal( false );
      } );
      test.skip('should retry if retry_count is specified', async () => {
        xhrMock.reset();
        // Here we mock out a second response from back end...
        xhrMock.get( new RegExp( "https://api.global\\-integration\\.product\\.dev\\.alertlogic\\.com\\/aims\\/v1\\/2\\/users.*", "i" ), once({
          status: 500,
          body: 'Unexpected result',
        }));
        xhrMock.get( new RegExp( "https://api.global\\-integration\\.product\\.dev\\.alertlogic\\.com\\/aims\\/v1\\/2\\/users.*", "i" ), once({
          status: 500,
          body: 'Unexpected result',
        }));
        xhrMock.get( new RegExp( "https://api.global\\-integration\\.product\\.dev\\.alertlogic\\.com\\/aims\\/v1\\/2\\/users.*", "i" ), once({
          status: 200,
          body: 'Final result',
        }));
        const result = await AlDefaultClient.get({ service_name: 'aims', version: 'v1', account_id: '2', path: 'users', retry_count: 3, retry_interval: 10 });                            //  fetch once
        expect( result ).to.equal( "Final result" );
      });
    } );

    // HTTP Operations
    describe('When', () => {
      describe.skip('posting form data', () => {
        test('should perform a POST operation with Content-Type header set to a value of "multipart/form-data"', async() => {
          const apiRequestParams: APIRequestParams = {service_name: 'aims', version: 'v1', account_id: '2'};
          xhrMock.post('https://api.global-integration.product.dev.alertlogic.com/aims/v1/2', (req, res) => {
            expect(req.method()).to.equal('POST');
            return res.status(200).body({});
          });
          await AlDefaultClient.form(apiRequestParams).then((r) => {
            expect(apiRequestParams.headers['Content-Type']).to.equal('multipart/form-data');
            expect(apiRequestParams.method).to.equal('POST');
          });
        });
      });
      describe.skip('performing a put of data', () => {
        test('should perform a PUT operation', async() => {
          const apiRequestParams: APIRequestParams = {service_name: 'aims', version: 'v1', account_id: '2'};
          xhrMock.put('https://api.global-integration.product.dev.alertlogic.com/aims/v1/2', (req, res) => {
            expect(req.method()).to.equal('PUT');
            return res.status(200).body({});
          });
          await AlDefaultClient.put(apiRequestParams).then((r) => {
            expect(apiRequestParams.method).to.equal('PUT');
          });
        });
      });
      describe.skip('calling the aliased PUT method', () => {
        test('should perform a PUT operation', async() => {
          const apiRequestParams: APIRequestParams = {service_name: 'aims', version: 'v1', account_id: '2'};
          xhrMock.put('https://api.global-integration.product.dev.alertlogic.com/aims/v1/2', (req, res) => {
            expect(req.method()).to.equal('PUT');
            return res.status(200).body({});
          });
          await AlDefaultClient.put(apiRequestParams).then((r) => {
            expect(apiRequestParams.method).to.equal('PUT');
          });
        });
      });
      describe.skip('performing a delete', () => {
        test('should perform a DELETE operation', async() => {
          const apiRequestParams: APIRequestParams = {service_name: 'aims', version: 'v1', account_id: '2'};
          xhrMock.delete('https://api.global-integration.product.dev.alertlogic.com/aims/v1/2', (req, res) => {
            expect(req.method()).to.equal('DELETE');
            return res.status(200).body({});
          });
          await AlDefaultClient.delete(apiRequestParams).then((r) => {
            expect(apiRequestParams.method).to.equal('DELETE');
          });
        });
      });
    });
    describe('when normalizing an outgoing request config',() => {
      describe('with an accept_header property', () => {
        test('set a headers object on the config object with an Accept prop set to the value of the original accept_header value', async() => {
          const config: APIRequestParams = { accept_header: 'foo/bar'};
          await AlDefaultClient.normalizeRequest(config).then((c) => {
            expect(c.headers).to.deep.equals({
              Accept: 'foo/bar'
            });
          });
        });
      });
      describe('with a response_type property', () => {
        test('set a responseType prop on the config object set to the original response_type value', async() => {
          const config: APIRequestParams = { response_type: 'something'};
          await AlDefaultClient.normalizeRequest(config).then((c) => {
            expect(c.responseType).to.equal('something');
          });
        });
      });
    });

    describe('when normalizing a request to get the fullURL',() => {
      describe('a GET request with parameters', () => {
        test('should return the full url', async() => {
          const config: APIRequestParams = { service_name: 'aims', version: 'v1', account_id: '2', path: 'users', params: {foo: 'bar', bar: 'foo'}, ttl: true };
          config.method = 'GET';
          let fullURL = await AlDefaultClient.fromConfigToFullUrl(config);
          expect(fullURL).equals("https://api.global-integration.product.dev.alertlogic.com/aims/v1/2/users?foo=bar&bar=foo");
        });
      });
      describe('a POST request with parameters', () => {
        test('should return the full url', async() => {
          const config: APIRequestParams = { service_name: 'aims', version: 'v1', account_id: '2', path: 'postme', ttl: true };
          config.method = 'POST';
          let fullURL = await AlDefaultClient.fromConfigToFullUrl(config);
          expect(fullURL).equals("https://api.global-integration.product.dev.alertlogic.com/aims/v1/2/postme");
        });
      });
      describe('a PUT request with parameters', () => {
        test('should return the full url', async() => {
          const config: APIRequestParams = { service_name: 'aims', version: 'v1', account_id: '2', path: 'putme', ttl: true };
          config.method = 'PUT';
          let fullURL = await AlDefaultClient.fromConfigToFullUrl(config);
          expect(fullURL).equals("https://api.global-integration.product.dev.alertlogic.com/aims/v1/2/putme");
        });
      });
      describe('a DELETE request with parameters', () => {
        test('should return the full url', async() => {
          const config: APIRequestParams = { service_name: 'aims', version: 'v1', account_id: '2', path: 'deleteme', ttl: true };
          config.method = 'DELETE';
          let fullURL = await AlDefaultClient.fromConfigToFullUrl(config);
          expect(fullURL).equals("https://api.global-integration.product.dev.alertlogic.com/aims/v1/2/deleteme");
        });
      });
      describe('for an MDR API Endpoint', () => {
        test('should properly install the service_name into the domain', async () => {
          const config:APIRequestParams = {
            service_stack: AlLocation.MDRAPI,
            service_name: 'responder',
            version: 1,
            account_id: "12345678",
            path: '/something/wicked',
            params: { 'this-way': 'comes' },
            method: 'GET',
            noEndpointsResolution: true
          };

          /**
           * First test covers URL calculation for MDR APIs without endpoints resolution.  Important feature: service_name should be
           * substituted into the domain name, and not the path, and the domain should be well formed.
           */
          let fullURL = await AlDefaultClient.fromConfigToFullUrl( config );
          expect( fullURL ).to.equal( "https://responder.mdr.product.dev.alertlogic.com/v1/12345678/something/wicked?this-way=comes" );

          /**
           * Second test covers URL calculation for MDR APIs WITH endpoints resolution.  MDR APIs should use endpoints data and still not
           * introduced the service_name into the path.
           */
          config.noEndpointsResolution = false;
          fullURL = await AlDefaultClient.fromConfigToFullUrl( config );
          expect( fullURL ).to.equal( "https://responder.mdr.product.dev.something.alertlogic.com/v1/12345678/something/wicked?this-way=comes" );

        } );
      } );
      describe('for a YARD API Endpoint', () => {
        test('should properly resolve the full URL', async () => {
          AlLocatorService.setContext( { environment:'production', residency: 'EMEA', insightLocationId: 'defender-uk-newport' } );
          const config: APIRequestParams = {
            service_stack: AlLocation.YARDAPI,
            version: 1,
            account_id: "12345678",
            path: '/something/wicked',
            params: { 'this-way': 'comes' },
            method: 'GET',
          };
          let fullURL = await AlDefaultClient.fromConfigToFullUrl(config);
          expect(fullURL).to.equal("https://yard.alertlogic.co.uk/v1/12345678/something/wicked?this-way=comes");
        });
        test('should properly resolve the full URL in a different datacenter', async () => {
          AlLocatorService.setContext( { environment:'production', residency: 'US', insightLocationId: 'defender-us-denver' } );
          const config: APIRequestParams = {
            service_stack: AlLocation.YARDAPI,
            version: 1,
            account_id: "12345678",
            path: '/something/wicked',
            params: { 'this-way': 'comes' },
            method: 'GET',
          };
          let fullURL = await AlDefaultClient.fromConfigToFullUrl(config);
          expect(fullURL).to.equal("https://yard.alertlogic.com/v1/12345678/something/wicked?this-way=comes");
        });
      });
    });
    describe('when flushCacheKeys is present',() => {
      let flushSpy;
      let cabinetStorage;
      beforeEach(() => {
        cabinetStorage = AlCabinet.local( 'apiclient.cache' );
        cabinetStorage.set('key1','value1');
        cabinetStorage.set('/url/with/data','value2');
        cabinetStorage.set('otherkey','value3');
        cabinetStorage.synchronize();
        // Testing storage.
        expect(cabinetStorage.get('otherkey')).equal('value3');
        flushSpy = vi.spyOn(AlDefaultClient,"flushCacheKeysFromConfig");
        xhrMock.post('https://api.product.dev.alertlogic.com/cargo/v1/2', (req, res) => {
          expect(req.method()).to.equal('POST');
          return res.status(200).body({});
        });
      });
      test.skip('should flush keys from cache', async() => {

        const config: APIRequestParams = { flushCacheKeys:['key1','/url/with/data','otherkey'], service_name: 'cargo', version: 'v1', account_id: '2', ttl: true };
        config.method = 'POST';
        await AlDefaultClient.post(config).then(() => {
          expect(cabinetStorage.get('key1')).equal(null);
          expect(cabinetStorage.get('/url/with/data')).equal(null);
          expect(cabinetStorage.get('otherkey')).equal(null);
          expect(flushSpy.mock.calls.length).equals(1);
        });
      });
    });

    describe.skip('when collectRequestLog is set to true',() => {
        beforeEach(() => {
          AlDefaultClient.collectRequestLog = true;
        });
        afterEach(()=>{
          AlDefaultClient.reset();
        });
        test('should log the details for a PUT request', async() => {
          const apiRequestParams: APIRequestParams = {service_name: 'aims', version: 'v1', account_id: '2'};
          xhrMock.put('https://api.global-integration.product.dev.alertlogic.com/aims/v1/2', (req, res) => {
            res.header('Content-Length', '44');
            expect(req.method()).to.equal('PUT');
            return res.status(200).body({"hello":"TinyBodyOf44bytes"});
          });
          await AlDefaultClient.put(apiRequestParams).then((r) => {
            expect(apiRequestParams.method).to.equal('PUT');
          });
          expect(AlDefaultClient.getExecutionRequestLog().length).equal(1);
          expect(AlDefaultClient.getExecutionRequestLog()[0].method).equal("PUT");
          expect(AlDefaultClient.getExecutionRequestLog()[0].responseContentLength).equal(44);
          expect(AlDefaultClient.getExecutionRequestLog()[0].durationMs).lessThan(100); // This is a mock so should be fast.
          expect(AlDefaultClient.getExecutionRequestLog()[0].url).equal("https://api.global-integration.product.dev.alertlogic.com/aims/v1/2");
        });
        test('should log the details for a GET request', async () => {
          // Here we mock out a second response from back end...
          xhrMock.get('https://api.global-integration.product.dev.alertlogic.com/aims/v1/2/users', once({
            status: 200,
            headers: {'Content-Length':'24'},
            body: "lot of users",
          }));
          let response = await AlDefaultClient.get({ service_name: 'aims', version: 'v1', account_id: '2', path: 'users'});
          expect(response).to.equals("lot of users"); // Response body should not be affected.
          expect(AlDefaultClient.getExecutionRequestLog().length).equal(1);
          expect(AlDefaultClient.getExecutionRequestLog()[0].method).equal("GET");
          expect(AlDefaultClient.getExecutionRequestLog()[0].responseContentLength).equal(24);
          expect(AlDefaultClient.getExecutionRequestLog()[0].durationMs).lessThan(100); // This is a mock so should be fast.
          expect(AlDefaultClient.getExecutionRequestLog()[0].url).equal("https://api.global-integration.product.dev.alertlogic.com/aims/v1/2/users");
        });
        test('should should log the details for a POST request', async() => {
          const apiRequestParams: APIRequestParams = {service_name: 'aims', version: 'v1', account_id: '2'};
          xhrMock.post('https://api.global-integration.product.dev.alertlogic.com/aims/v1/2', (req, res) => {
            res.header('Content-Length', '64');
            expect(req.method()).to.equal('POST');
            return res.status(200).body({"body":"This is the body of the post"});
          });
          await AlDefaultClient.form(apiRequestParams).then((r) => {
            expect(apiRequestParams.headers['Content-Type']).to.equal('multipart/form-data');
            expect(apiRequestParams.method).to.equal('POST');
          });
          expect(AlDefaultClient.getExecutionRequestLog().length).equal(1);
          expect(AlDefaultClient.getExecutionRequestLog()[0].method).equal("POST");
          expect(AlDefaultClient.getExecutionRequestLog()[0].responseContentLength).equal(64);
          expect(AlDefaultClient.getExecutionRequestLog()[0].durationMs).lessThan(100); // This is a mock so should be fast.
          expect(AlDefaultClient.getExecutionRequestLog()[0].url).equal("https://api.global-integration.product.dev.alertlogic.com/aims/v1/2");
        });
        test('should log the details for a DELETE request', async () => {
          const apiRequestParams: APIRequestParams = {service_name: 'aims', version: 'v1', account_id: '2'};
          xhrMock.delete('https://api.global-integration.product.dev.alertlogic.com/aims/v1/2', (req, res) => {
            res.header('Content-Length', '0');
            expect(req.method()).to.equal('DELETE');
            return res.status(200).body({});
          });
          await AlDefaultClient.delete(apiRequestParams).then((r) => {
            expect(apiRequestParams.method).to.equal('DELETE');
          });
          expect(AlDefaultClient.getExecutionRequestLog().length).equal(1);
          expect(AlDefaultClient.getExecutionRequestLog()[0].method).equal("DELETE");
          expect(AlDefaultClient.getExecutionRequestLog()[0].responseContentLength).equal(0);
          expect(AlDefaultClient.getExecutionRequestLog()[0].durationMs).lessThan(100); // This is a mock so should be fast.
          expect(AlDefaultClient.getExecutionRequestLog()[0].url).equal("https://api.global-integration.product.dev.alertlogic.com/aims/v1/2");
        });
        test.skip('should reset() clean execution log array', async () => {
          xhrMock.get('https://api.global-integration.product.dev.alertlogic.com/aims/v1/2/users', once({
            status: 200,
            body: "lot of users",
          }));
          let response = await AlDefaultClient.get({ service_name: 'aims', version: 'v1', account_id: '2', path: 'users'});
          expect(response).to.equals("lot of users"); // Response body should not be affected.
          expect(AlDefaultClient.getExecutionRequestLog().length).equal(1);
          // Calling reset.
          AlDefaultClient.reset();
          expect(AlDefaultClient.getExecutionRequestLog().length).equal(0);
        });
        test.skip('should getExecutionSummary() return a summary of requests in the log', async () => {
          let apiRequestParams: APIRequestParams = {service_name: 'aims', version: 'v1', account_id: '2'};

          xhrMock.post('https://api.global-integration.product.dev.alertlogic.com/aims/v1/2', (req, res) => {
            res.header('Content-Length', '256'); // We should measure the double 512.
            expect(req.method()).to.equal('POST');
            return res.status(200).body({"body":"This is the body a 256 size post"});
          });
          // First post.
          await AlDefaultClient.form(apiRequestParams).then((r) => {
            expect(apiRequestParams.headers['Content-Type']).to.equal('multipart/form-data');
            expect(apiRequestParams.method).to.equal('POST');
          });

          // Second post.
          await AlDefaultClient.form(apiRequestParams).then((r) => {
            expect(apiRequestParams.headers['Content-Type']).to.equal('multipart/form-data');
            expect(apiRequestParams.method).to.equal('POST');
          });

          let summaryTest = AlDefaultClient.getExecutionSummary();
          // let´s validate the summary.
          expect(summaryTest.numberOfRequests).equal(2);
          expect(summaryTest.totalBytes).equal(512);
          expect(summaryTest.totalRequestTime).lessThan(100); // This should be fast is a mock.
        });
    });
} );
