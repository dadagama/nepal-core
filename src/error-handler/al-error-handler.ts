import { AxiosResponse } from 'axios';
import { AlBaseError, AlAPIServerError, AlWrappedError, AlCabinet, AlGlobalizer } from '../common';
import { AlDefaultClient, APIRequestParams } from '../client';

export interface AlErrorDescriptor {
    title:string;
    description:string;
    details?:any;
}

/**
 * AlErrorHandler is a utility class meant to simplify error logging, upstream error reporting, and general error
 * formatting.
 */

export class AlErrorHandler
{
    public static initialized = false;
    public static categories:{[cat:string]:boolean} = {};
    public static upstream?:{(error:AlBaseError):void};
    public static verbose = false;
    protected static storage:AlCabinet;

    /**
     *  Logs a normalized error message to the console.
     *
     *  @param error Can be an AxiosResponse, Error, string, or anything else (although "anything else" will be handled with a generic error message);
     *  @param commentary If provided, is used to describe the error;
     *  @param categoryId If provided, describes the category of the logging output.
     *  @param overrideVerbosity If provided, the error will always be emitted to the console
     */
    public static log( error:AxiosResponse|AlBaseError|Error|string|any, commentary?:string, categoryId?:string, overrideVerbosity?:boolean ) {
        AlErrorHandler.prepare();
        const normalized = AlErrorHandler.normalize( error );
        if ( typeof error === 'string' && typeof categoryId === 'string'
                    &&
             ! commentary.includes(" ") && commentary.toLowerCase() === commentary && commentary.length < 32 ) {
            categoryId = commentary;
            commentary = undefined;
        }
        const effectiveCategoryId = categoryId ?? 'general';
        if ( overrideVerbosity || AlErrorHandler.verbose || AlErrorHandler.categories[effectiveCategoryId] || AlErrorHandler.categories["*"] ) {
            console.log( commentary ? `${commentary}: ${normalized.message}` : normalized.message );
            AlErrorHandler.categories[effectiveCategoryId] = true;
        }
    }

    /**
     * Reports an error to an external error reporting service (which must be attached separately)
     *
     * @param error A network error response, `Error` instance of any type, or string.
     * @param commentary If provided, it is used to describe the error in its console output and internally (not user facing).
     */
    public static report( error:AxiosResponse|AlBaseError|Error|string|any, commentary?:string ) {
        if ( AlErrorHandler.upstream ) {
            let normalized = AlErrorHandler.normalize( error );
            AlErrorHandler.upstream( normalized );
        } else {
            AlErrorHandler.log( new Error( `No error reporter is configured for AlErrorHandler` ) );
        }
        AlErrorHandler.log( error, commentary, undefined, true );
    }

    /**
     * Normalizes an error into an AlBaseError.
     *
     * @param error Can be an AxiosResponse (in which case the method will return an AlAPIServerError),
     *              any other Error or derived class, string, or anything.
     * @returns AlBaseError of the appropriate flavor.
     */
    public static normalize( error:AxiosResponse|AlBaseError|Error|string|any, commentary?:string ):AlBaseError {
        if ( error === undefined || error === null ) {
            return new AlBaseError( `An undefined or null value was thrown as an error` );
        } else if ( error instanceof AlBaseError ) {
            return error;
        } else if ( error instanceof Error ) {
            let message = error.message ?? "Unspecified error";
            if ( commentary ) {
                message = `${commentary}: ${message}`;
            }
            return new AlBaseError( message, error );
        } else if ( AlDefaultClient.isResponse( error ) ) {
            let config = error.config as APIRequestParams;
            let serviceName = `service_name` in config ? config.service_name : config.url;
            let statusCode = `status` in error ? error.status : 0;
            let errorText = `Received an unexpected ${statusCode} (${error.statusText}) response from '${serviceName}' at '${error.config.url}'.`;
            if ( commentary ) {
                errorText = `${commentary}: ${errorText}`;
            }
            return new AlAPIServerError( errorText, serviceName, statusCode, error );
        } else if ( typeof( error ) === 'string' ) {
            if ( commentary ) {
                error = `${commentary}: ${error}`;
            }
            return new AlBaseError( error );
        } else {
            return new AlBaseError( commentary || `An unexpected internal error occurred.`, error );
        }
    }

    /**
     * Enables logging of one or more error categories.  The default category is "general".
     */
    public static enable( ...categories:string[] ) {
        const storage = AlErrorHandler.prepare();
        categories.forEach( ( categoryId ) => {
            AlErrorHandler.categories[categoryId] = true;
        } );
        storage.set( "visible", AlErrorHandler.categories ).synchronize();
    }

    /**
     * Enables logging of one or more error categories.  The default category is "general".
     */
    public static disable( ...categories:string[] ) {
        const storage = AlErrorHandler.prepare();
        categories.forEach( ( categoryId ) => {
            if ( categoryId === '*' ) {
                AlErrorHandler.categories = {};
                AlErrorHandler.verbose = false;
            } else {
                delete AlErrorHandler.categories[categoryId];
            }
        } );

        storage.set( "visible", AlErrorHandler.categories ).synchronize();
    }

    public static wrap( error:AxiosResponse|AlBaseError|Error|string|any, message:string ):AlWrappedError {
        return new AlWrappedError( message, error );
    }

    public static describe( error:any, verbose = true ):AlErrorDescriptor {

        let title = "Something is wrong";
        let description = AlErrorHandler.getErrorDescription( error, verbose );
        let details:any;

        if ( AlDefaultClient.isResponse( error ) ) {
            //  This error is an HTTP response descriptor, indicating an API error has occurred -- format appropriately
            title = "Unexpected API Response";
            details = AlErrorHandler.redact( AlErrorHandler.compactErrorResponse( error ) );
        } else if ( error instanceof AlWrappedError ) {
            //  This error is an outer error with a reference to an inner exception.
            details = AlErrorHandler.redact( AlErrorHandler.compactWrappedError( error ) );
        } else if ( error instanceof Error ) {
            //  Generic Error object
            details = AlErrorHandler.redact( AlErrorHandler.compactError( error ) );
        }

        return { title, description, details };
    }

    /**
     *  Utility function to descend into arbitrarily nested and potentially circular data, replacing any AIMS tokens
     *  or Authorization headers with a redaction marker.
     *
     *  If `trimCircularity` is true (default), circular references will be flattened with a special string, making the object
     *  suitable for serialization.
     */
    public static redact( info:any, trimCircularity:boolean = true, circular:any[] = [] ):any {
        if ( typeof( info ) === 'object' && info !== null ) {
            if ( circular.includes( info ) ) {
                if ( trimCircularity ) {
                    return "(circular)";
                }
            } else {
                circular.push( info );
                Object.keys( info ).forEach( key => {
                    if ( /x-aims-auth-token/i.test( key ) || /authorization/i.test( key ) ) {
                        info[key] = 'XXXXX'; //  REDACTED
                    } else {
                        info[key] = AlErrorHandler.redact( info[key], trimCircularity, circular );
                    }
                } );
            }
        } else if ( typeof( info ) === 'string' ) {
            return info.replace( /X-AIMS-Auth-Token['"\s:]*([a-zA-Z0-9+\=\/]+)['"]/gi,
                                 ( completeMatch:string, token:string ) => completeMatch.replace( token, 'XXXXX' ) )
                       .replace( /Authorization['"\s:]*([a-zA-Z0-9+\=\/\s]+)['"]/gi,
                                 ( completeMatch:string, token:string ) => completeMatch.replace( token, 'XXXXX' ) );
        }
        return info;
    }

    protected static prepare():AlCabinet {
        if ( ! AlErrorHandler.initialized ) {
            AlErrorHandler.storage = AlCabinet.persistent("errors");
            let categories = AlErrorHandler.storage.get( "visible", {} );
            if ( typeof( categories ) !== 'object' || categories === null ) {
                categories = {};
            }
            AlErrorHandler.verbose = !!categories["*"];
            if ( Object.keys( categories ).length > 0 ) {
                console.log(`Notice: logging enabled for categories [${Object.keys(categories).join(", ")}]` );
            }
            AlErrorHandler.categories = categories;
            AlErrorHandler.initialized = true;
        }
        return AlErrorHandler.storage;
    }

    protected static getErrorDescription( error:any, verbose = true ):string {
        if ( typeof( error ) === 'string' ) {
            return error;
        } else if ( AlDefaultClient.isResponse( error ) ) {
            return AlErrorHandler.getResponseDescription( error, verbose );
        } else if ( error instanceof AlWrappedError ) {
            return AlErrorHandler.consolidateWrappedErrorDescription( error, verbose );
        } else if ( error instanceof Error ) {
            return error.message;
        } else {
            if ( verbose ) {
                return "An unknown error prevented this view from rendering.  If this persists, please contact Alert Logic support for assistance.";
            } else {
                return "An internal error occurred.";
            }
        }
    }

    protected static compactErrorResponse( response:AxiosResponse<any> ):any {
        return {
            data: response.data,
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            config: response.config
        };
    }

    protected static compactWrappedError( error:AlWrappedError ):any {
        let cursor = error;
        const stack = [];
        while( cursor ) {
            if ( AlDefaultClient.isResponse( cursor ) ) {
                stack.push( AlErrorHandler.compactErrorResponse( cursor ) );
            } else if ( cursor instanceof Error ) {
                stack.push( AlErrorHandler.compactError( cursor ) );
            } else if ( typeof( cursor ) === 'string' ) {
                stack.push( cursor );
            } else {
                stack.push( "Eggplant Parmesiano with Spider Eggs" );
            }
            if ( cursor instanceof AlWrappedError ) {
                cursor = cursor.getInnerError();
            } else {
                cursor = null;
            }
            cursor = cursor instanceof AlWrappedError ? cursor.getInnerError() : null;
        }
        return stack;
    }

    protected static compactError( error:Error, type:string = "Error", otherProperties?:any ):any {
        const compact:any = {
            type,
            message: error.message,
            stack: error.stack ? error.stack.split( "\n" ).map( line => line.trim() ) : null
        };
        if ( otherProperties ) {
            Object.assign( compact, otherProperties );
        }
        return compact;
    }

    protected static consolidateWrappedErrorDescription( error:AlWrappedError|Error|AxiosResponse|string, verbose = true ) {
        let description = '';
        let cursor = error;
        let adjustCapitalization = ( text:string ) => {
            if ( ! text || text.length === 0 ) {
                return '';
            }
            if ( description.length > 0 ) {
                let firstChar = text[0];
                if ( firstChar === firstChar.toUpperCase() ) {
                    return firstChar.toLowerCase() + text.substring( 1 );
                }
            }
            return text;
        };
        while( cursor ) {
            if ( description.length > 0 ) {
                description += `: `;
            }
            if ( cursor instanceof Error ) {
                description += adjustCapitalization( cursor.message );
            } else if ( AlDefaultClient.isResponse( cursor ) ) {
                description += adjustCapitalization( AlErrorHandler.getResponseDescription( cursor, verbose ) );
            } else if ( typeof( cursor ) === 'string' ) {
                description += adjustCapitalization( cursor );
            }
            cursor = cursor instanceof AlWrappedError ? cursor.getInnerError() : null;
        }
        return description;
    }

    /**
     * Matches a response TODO(kjn): hook this up to the content service, when it's available, and use content from there instead of here :)
     */
    protected static getResponseDescription( response:AxiosResponse<any>, verbose = true ) {
        const request = response.config as APIRequestParams;
        const serviceName = 'service_name' in request ? request.service_name : "a required service";
        const status = response.status;
        const statusText = response.statusText;
        switch( status ) {
            case 400 :
                if ( verbose ) {
                    return `${serviceName} doesn't appear to understand one of our requests.  If this condition persists, please contact Alert Logic support.`;
                } else {
                    return `${serviceName} did not understand our request.`;
                }

            case 401 :
                if ( verbose ) {
                    return `${serviceName} doesn't appear to be accepting our identity or authentication state.  If this condition persists after reauthenticating, please contact Alert Logic support.`;
                } else {
                    return `${serviceName} did not recognize our credentials.`;
                }

            case 403 :
                if ( verbose ) {
                    return `${serviceName} is denying our authorization to access its data.  If this condition persists after reauthenticating, please contact Alert Logic support.`;
                } else {
                    return `${serviceName} denied access to us.`;
                }

            case 404 :
                if ( verbose ) {
                    return "The data you are trying to access doesn't appear to exist.  If you are certain this is an error and the condition persists, please contact Alert Logic support.";
                } else {
                    return `${serviceName} could not find a resource.`;
                }

            case 410 :
                if ( verbose ) {
                    return "The data you're trying to access doesn't appear to exist anymore.  If you are certain this is an error and the condition persists, please contact Alert Logic support.";
                } else {
                    return `${serviceName} could not return a deleted resource.`;
                }

            case 418 :
                if ( verbose ) {
                    return "Sadly, the data you're looking for has turned into a teapot.  Tragic but delicious!";
                } else {
                    return `${serviceName} is short and stout.`;
                }

            case 500 :
                if ( verbose ) {
                    return `${serviceName} has experienced an unexpected internal error.  If this condition persists, please contact Alert Logic support.`;
                } else {
                    return `${serviceName} experienced an internal error.`;
                }

            case 502 :
                if ( verbose ) {
                    return `${serviceName} has failed because of an unexpected response from an upstream service.  If this condition persists, please contact Alert Logic support.`;
                } else {
                    return `${serviceName} reported an upstream error.`;
                }

            case 503 :
                if ( verbose ) {
                    return `${serviceName} is currently unavailable.  If this condition persists, please contact Alert Logic support.`;
                } else {
                    return `${serviceName} is unavailable.`;
                }

            case 504 :
                if ( verbose ) {
                    return `${serviceName} is not responding quickly enough.  If this condition persists, please contact Alert Logic support.`;
                } else {
                    return `${serviceName} timed out.`;
                }

            default :
                if ( verbose ) {
                    return `${serviceName} responded in an unexpected way (${status}/${statusText}).  If this condition persists, please contact Alert Logic support.`;
                } else {
                    return `${serviceName} responded with status ${statusText} (${status})`;
                }
        }
    }
}

AlGlobalizer.expose( 'al.error', {
    enable: ( ...categories:string[] ) => AlErrorHandler.enable( ...categories ),
    disable: ( ...categories:string[] ) => AlErrorHandler.disable( ...categories ),
} );
