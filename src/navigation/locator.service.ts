import { AlLocationContext, AlLocationDescriptor } from '../abstract';
import { AlGlobalizer } from '../common';
import { AlLocation, AlInsightLocations } from './constants';
import { AlLocationDictionary } from './location-dictionary';

class UriMappingItem {

/* tslint:disable:variable-name */
    protected _url:string;
    protected _prefix:string;
    protected _matcher?:RegExp;

    public get url():string {
        return this._url;
    }

    public get matcher():RegExp {
        if ( ! this._matcher ) {
            this._matcher = new RegExp( this.escapeLocationPattern( this._url ) );
        }
        return this._matcher;
    }

    public get prefix():string {
        if ( ! this._prefix ) {
            const wildcardOffset = this._url.indexOf("*");
            this._prefix = wildcardOffset === -1 ? this._url : this._url.substring( 0, wildcardOffset );
        }
        return this._prefix;
    }

    constructor( public location:AlLocationDescriptor,
                 public aliasBaseUrl?:string ) {
        this._url = aliasBaseUrl ?? location.uri;
    }

    /**
     * Escapes a domain pattern.
     *
     * All normal regex characters are escaped; * is converted to [a-zA-Z0-9_]+; and the whole expression is wrapped in ^....*$.
     */
    protected escapeLocationPattern( uri:string ):string {
        let pattern = "^" + uri.replace(/[-\/\\^$.()|[\]{}]/g, '\\$&');     //  escape all regexp characters except *, add anchor
        pattern = pattern.replace( /\*/g, "([a-zA-Z0-9_\-]+)" );            //  convert * wildcard into group match with 1 or more characters
        pattern += ".*$";                                                   //  add filler and terminus anchor
        return pattern;
    }
}

/**
 * @public
 *
 * This class accepts a list of location descriptors, an acting URL, and an optional context specification, and provides the ability
 * to calculate environment- and residency- specific target URLs.
 */
export class AlLocatorServiceInstance
{
    private actingUrl:string|undefined;
    private actor:AlLocationDescriptor|undefined;

    private knownLocations:AlLocationDescriptor[]                   =   [];
    private nodeDictionary:{[hashKey:string]:AlLocationDescriptor}  =   {};     //  hash to location
    private locTypeMap:{[locTypeId:string]:UriMappingItem[]}        =   {};     //  location type (e.g., AlLocation.MagmaUI) to locations
    private nodeCache:{[locTypeId:string]:AlLocationDescriptor}     =   {};     //  location type to active location
    private byPrefix:UriMappingItem[]                               =   [];
    private uriMap:{[pattern:string]:UriMappingItem[]}              =   {};

    private context:AlLocationContext = {
        environment:        "production",
        residency:          "US",
        insightLocationId:  undefined,
        accessible:         undefined
    };


    constructor( nodes:AlLocationDescriptor[] = [], actingUrl:string|boolean = true, context?:AlLocationContext ) {
        if ( context ) {
            this.setContext( context );
        }
        if ( nodes && nodes.length ) {
            this.setLocations( nodes );
        }
        if ( typeof( actingUrl ) === 'boolean' || actingUrl ) {
            this.setActingUrl( actingUrl );
        }
    }

    /**
     * Resets locator state to its "factory presets"
     */
    public reset() {
        this.nodeCache = {};
        this.context = {
            environment:        "production",
            residency:          "US",
            insightLocationId:  undefined,
            accessible:         undefined
        };
        this.actingUrl = undefined;
    }

    /**
     * Retrieves the ID of the environment associated with the current acting URL.
     */
    public getCurrentEnvironment():string {
        return this.context.environment || "production";
    }

    /**
     * Retrieves the current residency (US or EMEA)
     */
    public getCurrentResidency():string {
        return this.context.residency || "US";
    }

    /**
     * Retrieves the current path, or returns empty string if we are executing in the context of the root document
     */
    public getCurrentPath():string {
        return this.context.path || "";
    }

    /**
     * Arguably the only important general-purpose functionality of this service.
     * Calculates a URL from a location identifier, an optional path fragment, and an optional context.
     *
     * @returns The resulting URL.
     */
    public resolveURL( locTypeId:string, path?:string, context?:AlLocationContext ) {
        const loc = this.getNode( locTypeId, context );
        let url:string;
        if ( loc ) {
            url = loc.uri;
            //  For historical reasons, some nodes (like auth0) are represented without protocols (e.g., alertlogic-integration.auth0.com instead of https://alertlogic-integration.auth0.com).
            //  For the purposes of resolving functional links, detect these protocolless domains and add the default https:// protocol to them.
            if ( ! url.startsWith("http") ) {
                url = `https://${url}`;
            }
        } else {
            /* istanbul ignore else */
            if ( typeof( window ) !== 'undefined' ) {
                url = window.location.origin + ( ( window.location.pathname && window.location.pathname.length > 1 ) ? window.location.pathname : '' );
            } else {
                url = "http://localhost:9999";
            }
        }
        if ( path ) {
            url += url.endsWith("/") && path.startsWith( "/" ) ? path.substring( 1 ) : path;    //  make sure we don't add trailing slashes
        }
        return url;
    }

    /**
     *  Resolves a literal URI to a service node.  Note that the order of `this.byPrefix` from highest-to-lowest prefix complexity is necessary for
     *  this to work properly.
     */
    public getMappingByURI( targetURI:string ):UriMappingItem|undefined {
        let hit = this.byPrefix.find( mapping => {
            if ( mapping.location.external || ! targetURI.startsWith( mapping.prefix ) ) {
                return false;
            }
            return mapping.matcher.test( targetURI );
        } );
        if ( ! hit ) {
            return undefined;
        }
        return hit;
    }

    public getNodeByURI( targetURI:string ):AlLocationDescriptor|undefined {
        let mapping = this.getMappingByURI( targetURI );
        return mapping ? mapping.location : undefined;
    }

    /**
     *  Gets the currently acting node.
     */
    public getActingNode():AlLocationDescriptor|undefined {
        return this.actor;
    }

    /**
     *  @deprecated
     *
     *  Nested nodes (e.g., an application living inside another application) are official dead, making this method
     */
    /* tslint:disable:no-unused-variable */
    public resolveNodeURI( node:AlLocationDescriptor ):string {
        console.warn("Deprecation warning: please do not use resolveNodeURI directly; just use the location's 'uri' property." );
        return node.uri;
    }

    /**
     *  Updates the locator matrix model with a set of service node descriptors.
     *
     *  @param nodes - A list of service node descriptors.
     */
    public setLocations( nodes:AlLocationDescriptor[] ) {
        this.knownLocations = [ ...nodes ];
        this.nodeDictionary = {};
        this.byPrefix = [];
        this.nodeCache = {};
        this.locTypeMap = {};
        this.knownLocations.forEach( branchNode => {
            const environments:string[] = typeof( branchNode.environment ) === 'string' ? branchNode.environment.split("|") : [ 'production' ];
            environments.forEach( environment => {
                let leafNode = Object.assign( {}, branchNode, { environment: environment } );
                this.nodeDictionary[`${leafNode.locTypeId}-*-*`] = leafNode;
                this.nodeDictionary[`${leafNode.locTypeId}-${environment}-*`] = leafNode;
                if ( leafNode.residency ) {
                    this.nodeDictionary[`${leafNode.locTypeId}-${environment}-${leafNode.residency}`] = leafNode;
                    if ( leafNode.insightLocationId ) {
                        this.nodeDictionary[`${leafNode.locTypeId}-${environment}-${leafNode.residency}-${leafNode.insightLocationId}`] = leafNode;
                    }
                }
                if ( leafNode.external ) {
                    return;
                }

                this.indexLocation( leafNode );
            } );
        } );
        this.byPrefix.sort( ( a, b ) => b.prefix.length - a.prefix.length );        //  Note: order of this array is essential to the correct function of `getNodeByURI`
    }

    public indexLocation( location:AlLocationDescriptor ) {
        this.indexMapping( new UriMappingItem( location ) );

        location.aliases?.forEach( alias => this.indexMapping( new UriMappingItem( location, alias ) ) );
    }

    public indexMapping( mapping:UriMappingItem ) {
        this.byPrefix.push( mapping );
        if ( ! ( mapping.location.locTypeId in this.locTypeMap ) ) {
            this.locTypeMap[mapping.location.locTypeId] = [];
        }
        this.locTypeMap[mapping.location.locTypeId].push( mapping );
    }

    public remapLocationToURI( locTypeId:string, uri:string, environment?:string, residency?:string ) {
        this.nodeCache = {};    //  flush lookup cache
        const remap = ( node:AlLocationDescriptor ) => {
            node.uri = uri;
            node.environment = environment || node.environment;
            node.residency = residency || node.residency;
        };
        for ( let hashKey in this.nodeDictionary ) {
            if ( this.nodeDictionary.hasOwnProperty( hashKey ) ) {
                if ( this.nodeDictionary[hashKey].locTypeId === locTypeId ) {
                    remap( this.nodeDictionary[hashKey] );
                }
            }
        }
        Object.values( this.uriMap ).forEach( candidates => {
            candidates.forEach( match => {
                if ( match.location.locTypeId === locTypeId ) {
                    remap( match.location );
                }
            } );
        } );
        this.setActingUrl( true, true );
    }

    public setActingUrl( actingUrl:string|boolean|undefined, forceRefresh:boolean = false ) {
        if ( actingUrl === undefined ) {
            this.actingUrl = undefined;
            this.actor = undefined;
            return;
        }

        if ( typeof( actingUrl ) === 'boolean' ) {
            /* istanbul ignore else */
            if ( typeof( window ) !== 'undefined' ) {
                actingUrl = window.location.origin + ( ( window.location.pathname && window.location.pathname.length > 1 ) ? window.location.pathname : '' );
            } else {
                actingUrl = "http://localhost:9999";
            }
        }
        /**
         *  This particular piece of black magic is responsible for identifying the active node by its URI
         *  and updating the ambient context to match its environment and data residency attributes.  It is
         *  opaque for a reason :)
         */
        if ( actingUrl !== this.actingUrl || forceRefresh ) {
            this.actingUrl = actingUrl;
            const mapping = this.getMappingByURI( actingUrl );
            const base = this.getBaseUrl( actingUrl );
            const path = this.extractUrlPath( actingUrl );

            if ( mapping ) {
                this.actor = mapping.location;
                this.actor.uri = `${base}${path ? `/${path}` : ''}`;

                this.setContext( {
                    path,
                    environment: this.actor.environment || this.context.environment,
                    residency: this.actor.residency || this.context.residency,
                } );
            } else {
                let environment = "production";
                if ( actingUrl.startsWith("http://localhost" ) ) {
                    environment = "development";
                } else if ( actingUrl.includes("product.dev.alertlogic.com") ) {
                    environment = "integration";
                }
                this.setContext( {
                    environment,
                    path,
                    residency:          "US",
                    insightLocationId:  undefined,
                    accessible:         undefined,
                } );
            }
        }
    }

    public search( filter:{(node:AlLocationDescriptor):boolean} ):AlLocationDescriptor[] {
        return Object.values( this.nodeDictionary ).filter( filter );
    }

    public findOne( filter:{(node:AlLocationDescriptor):boolean} ):AlLocationDescriptor|undefined {
        return Object.values( this.nodeDictionary ).find( filter );
    }

    /**
     *  Sets the acting context (preferred environment, data residency, location attributes).
     *  This acts as a merge against existing context, so the caller can provide only fragmentary information without borking things.
     */
    public setContext( context?:AlLocationContext ) {
        this.nodeCache = {};    //  flush lookup cache
        this.context.insightLocationId = context && context.insightLocationId ? context.insightLocationId : this.context.insightLocationId;
        this.context.accessible = context && context.accessible && context.accessible.length ? context.accessible : this.context.accessible;
        /* istanbul ignore next */
        if ( this.context.insightLocationId ) {
            let locationNode = this.findOne( n => { return n.insightLocationId === this.context.insightLocationId; } );
            if ( locationNode && locationNode.residency ) {
                this.context.residency = locationNode.residency;
            }
            //  This block defaults to setting contextual residency to match the bound location.
        }
        this.context.environment = context && context.environment ? context.environment : this.context.environment;
        this.context.residency = context && context.residency ? context.residency : this.context.residency;
        this.context.path = context && context.path ? context.path : "";
        this.normalizeContext();
    }

    public getContext():AlLocationContext {
        return this.context;
    }

    /**
     *  Gets a service node by ID, optionally using a context to refine its selection logic.  The context defaults
     *  to the locator matrix instance's current context; if the default is used, the result of the lookup will be stored
     *  for performance optimization.
     *
     *  @param locTypeId - The ID of the service node to select.  See al-service-identity.ts for constant values.
     *  @param context - Additional context to shape the selection logic.
     *
     *  @returns A node descriptor (or null, if no node matches).
     */
    public getNode( locTypeId:string, context?:AlLocationContext ):AlLocationDescriptor|null {
        if ( this.nodeCache.hasOwnProperty( locTypeId ) && !context ) {
            return this.nodeCache[locTypeId];
        }
        let environment = context && context.environment ? context.environment : this.context.environment;
        let residency = context && context.residency ? context.residency : this.context.residency;
        let insightLocationId = context && context.insightLocationId ? context.insightLocationId : this.context.insightLocationId;
        let accessible = context && context.accessible ? context.accessible : this.context.accessible;
        let node = null;

        if ( insightLocationId ) {
            if ( this.nodeDictionary.hasOwnProperty( `${locTypeId}-${environment}-${residency}-${insightLocationId}` ) ) {
                node = this.nodeDictionary[`${locTypeId}-${environment}-${residency}-${insightLocationId}`];
            }
        }

        if ( ! node && accessible && accessible.length ) {
            for ( let i = 0; i < accessible.length; i++ ) {
                let accessibleLocationId = accessible[i];
                if ( accessibleLocationId !== insightLocationId ) {
                    if ( this.nodeDictionary.hasOwnProperty( `${locTypeId}-${environment}-${residency}-${accessibleLocationId}` ) ) {
                        node = this.nodeDictionary[`${locTypeId}-${environment}-${residency}-${accessibleLocationId}`];
                    }
                }
            }
        }
        if ( ! node && environment && residency && this.nodeDictionary.hasOwnProperty( `${locTypeId}-${environment}-${residency}`) ) {
            node = this.nodeDictionary[`${locTypeId}-${environment}-${residency}`];
        }
        if ( ! node && environment && this.nodeDictionary.hasOwnProperty( `${locTypeId}-${environment}-*`) ) {
            node = this.nodeDictionary[`${locTypeId}-${environment}-*`];
        }
        if ( ! node && this.nodeDictionary.hasOwnProperty( `${locTypeId}-*-*`) ) {
            node = this.nodeDictionary[`${locTypeId}-*-*`];
        }
        if ( node && ! context ) {
            //  Save it in a dictionary for faster lookup next time
            this.nodeCache[locTypeId] = node;
        }

        return node;
    }

    /**
     * Traps the pathname portion of a URI
     */
    protected extractUrlPath( url:string ):string|undefined {
        let match = url.match( /https?:\/\/[^\/]+\/([^\?#]*)/ );
        if ( match && match.length === 2 ) {
            let path = match[1];
            if ( path.endsWith("/") ) {
                path = path.substring( 0, match[1].length - 1 );
            }
            return path;
        }
        return undefined;
    }


    /**
     * Chops off fragments, query strings, and any trailing slashes, and returns what *should* be just the base URL.
     * I make no promises about the quality of this code when confronted with incorrect or incomplete inputs.
     */
    protected getBaseUrl( uri:string ):string {
        const matches = /(^https?:\/\/[a-zA-Z0-9_\-\.:]+)(.*$)/.exec( uri );
        if ( matches ) {
            return matches[1];
        }
        if ( uri.indexOf("#") !== -1 ) {
            uri = uri.substring( 0, uri.indexOf("#") );
        }
        if ( uri.indexOf("?") !== -1 ) {
            uri = uri.substring( 0, uri.indexOf("?" ) );
        }
        if ( uri.length > 0 && uri[uri.length-1] === '/' ) {
            uri = uri.substring( 0, uri.length - 1 );
        }
        return uri;
    }

    /**
     * This method normalizes the current context.  In practice, this means mapping an insight location ID to the correct defender datacenter.
     * In other words, it is "black magic."  Or at least, dark gray.
     */
    protected normalizeContext() {
        if ( ! this.context.insightLocationId || ! this.context.accessible ) {
            return;
        }
        if ( ! AlInsightLocations.hasOwnProperty( this.context.insightLocationId ) ) {
            return;
        }
        const insightLocation = AlInsightLocations[this.context.insightLocationId];
        if ( insightLocation.alternatives ) {
            let selected = null;
            for ( let i = 0; i < insightLocation.alternatives.length; i++ ) {
                let candidateLocationId = insightLocation.alternatives[i];
                if ( this.context.accessible.indexOf( candidateLocationId ) !== -1 ) {
                    selected = candidateLocationId;
                    break;
                }
            }
            if ( selected === null ) {
                selected = insightLocation.alternatives[0];
            }
            this.context.insightLocationId = selected;
        }
        if ( insightLocation.residency && this.context.residency !== insightLocation.residency ) {
            //  Location IDs have higher specificity than residency settings, so given defender-uk-newport and residency: US, the residency should be overridden to reflect EMEA.
            this.context.residency = insightLocation.residency;
        }
    }
}

export const AlLocatorService:AlLocatorServiceInstance = AlGlobalizer.instantiate( 'locator', () => new AlLocatorServiceInstance( AlLocationDictionary ) );


