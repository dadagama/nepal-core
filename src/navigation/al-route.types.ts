/**
 *  This is a collection of interfaces and types for cross-application routing.
 *
 *  Author: McNielsen <knielsen@alertlogic.com>
 *  Copyright 2017 Alert Logic Inc.
 */

import { AlLocatorService } from './locator.service';
import { AlRuntimeConfiguration } from '../configuration';

/**
 * @public
 *
 * Any navigation host must provide these basic functions
 */
export interface AlRoutingHost
{
    /* Exposes the current URL, actingAccountId, and primaryAccountId of the application (required). */
    currentUrl:string;

    /* Routing parameters */
    routeParameters: {[parameter:string]:string};
    setRouteParameter( parameter:string, value:string ):void;
    deleteRouteParameter( parameter:string ):void;

    /* Named routes - actions that can be reused by multiple menu items or invoked imperatively from code */
    getRouteByName?( routeName:string ):AlRouteDefinition;

    /* Shared conditions */
    getConditionById( conditionId:string ):AlRouteCondition|boolean;

    /* Link decoration - allows manipulation of `href` properties for link menu items. */
    decorateHref?( route:AlRoute ):void;

    /* Bookmarks - arguably the worst name for a navigation construct I've chosen in years!  But super useful, I swear. */
    setBookmark( bookmarkId:string, route:AlRoute ):void;
    getBookmark( bookmarkId:string ):AlRoute;

    /* Asks the host to execute a given route's action. */
    dispatch(route:AlRoute, params?:{[param:string]:string}):void;

    /* Asks the host to evaluate various types of environmental conditions */
    evaluate( condition:AlRouteCondition ):boolean|boolean[];
}

/**
 * @internal
 *
 * This empty or "null" routing host is provided as a convenience for unit tests,
 * debugging, and placeholder or empty menu structures.
 */
/* tslint:disable:variable-name */
/* istanbul ignore next */
export const AlNullRoutingHost = {
    currentUrl: '',
    routeParameters: {} as {[i:string]:string},
    bookmarks: {} as {[i:string]:AlRoute},
    setRouteParameter: ( parameter:string, value:string ) => {
        AlNullRoutingHost.routeParameters[parameter] = value;
    },
    deleteRouteParameter: ( parameter:string ) => {
        delete AlNullRoutingHost.routeParameters[parameter];
    },
    setBookmark: ( bookmarkId:string, route:AlRoute ) => {
        AlNullRoutingHost.bookmarks[bookmarkId] = route;
    },
    getBookmark: ( bookmarkId:string ) => {
        return AlNullRoutingHost.bookmarks[bookmarkId];
    },
    getConditionById: ( conditionId:string ) => {
        return conditionId ? false : false; /* bah */
    },
    dispatch: () => {},
    evaluate: ( condition:AlRouteCondition ) => {
        return condition ? false : false;
    }
};

/**
 *  @public
 */
export interface AlRouteCondition
{
    //  If the condition is a shared condition, this is the ID/hash used to identify it
    conditionId?:string;

    //  must be "any", "all", or "none", and defaults to "all"
    rule?:"any"|"all"|"none";

    //  An array of child conditions to evaluate using the indicated rule
    conditions?:AlRouteCondition[];
    //
    //  An array of regular expressions
    path_matches?:string;                   //  Path matches a given regular expression

    //  An array of route parameters (or equivalence tests) that must be satisfied
    parameters?:string[];                   //  An array of route parameters that must be present, or parameter equivalence tests that must be true

    //  If specified, indicates whether the menu item should only appear if authenticated (true) or unauthenticated (false).  Note that
    //  entitlement and account conditions automatically imply an authentication test.
    authentication?:boolean;

    //  An array of entitlement expressions to evaluate against the acting account's entitlements
    entitlements?:string[];

    //  An array of entitlement expressions to evaluate against the primary account's entitlements
    primaryEntitlements?:string[];

    //  An array of environments to match against (e.g., "integration", "development", "production", etc.)
    environments?:string[];

    //  An array of account IDs that fulfill the condition
    accounts?:string[];

    //  Account property/value arrays
    accountProps?:{ name:string, values:any[] }[];

    //  An array of user IDs that fulfill the condition
    userIds?:string[];

    //  An array of primary account IDs that fulfill the condition
    primaryAccounts?:string[];

    //  Primary account property/value arrays
    primaryAccountProps?:{ name:string, values:any[] }[];

    //  An array of locations to match against (e.g., "defender-us-denver", "insight-us-virginia", etc), measured against the acting account.
    locations?:string[];

    //  An array of locations to match against, measured against the primary account
    primaryLocations?:string[];

    //  An array of navigation experiences to match against (e.g., "beta", "default", "delta", "omega-123").  Please note that this matches
    //  both the "global" experience and any experience mappings that may be true (e.g., log#siemless or search#universal).
    experiences?:string[];

    //  If provided, the timestamp or iso8601 datetime string after which the condition will evaluate true
    after?:string|number;

    //  If provided, the timestamp or iso8601 datetime string before which the condition will evaluate true
    before?:string|number;
}

/**
 *  @public
 *  The action associated with a route.  These are only the most common properties.
 */
export interface AlRouteAction
{
    /**
     *  What type of action does this route have?  Valid types are 'link', 'trigger', and 'callback'
     */
    type:string;

    /**
     * If the route action is 'link' (default), these properties indicate which application (location)
     * and route (path) OR url (fully qualified) the link should point to.
     */
    location?:string;
    path?:string;
    url?:string;

    /**
     * If the type of the action is 'trigger', this is the name of the event to be triggered.
     */
    trigger?:string;

    /**
     * If the type of the action is 'callback', this is the anonymous function that will be executed.
     */
    callback?:{(route:AlRoute,mouseEvent?:any):void};
}

/**
 *  @public
 *
 *  This is an abstract definition for a single menu item or menu container.
 */
export interface AlRouteDefinition {

    /* The caption of the menu item */
    caption:string;

    /* An arbitrary identifier associated with this menu item.  This is most useful (practically) for retrieving specific menu items by code. */
    id?:string;

    /* An arbitrary name associated with this menu item.  These augment named routes for conditional schema branches.  And if that sounds vaguely
    * gibberishy -- (wasntme) */
    name?:string;

    /* An arbitrary bookmark code for this menu item.  This allows a specific submenu to be retrieved and worked with programmatically. */
    bookmarkId?:string;

    /* Arbitrary properties */
    properties?: {[property:string]:any};

    /* The action to perform when the menu item is clicked.
     * If the provided value is a string, it will be treated as a reference to a named route in the current schema. */
    action?:AlRouteAction|string;

    /* A condition that can be evaluated to calculated the `enabled` property at any given moment.
     * This can be a fixed boolean value, a shared condition ID (see AlNavigationSchema.conditions), or a condition literal. */
    enabled?:AlRouteCondition|string|boolean;

    /* A condition that can be evaluated to calculate the `visible` property at any given moment.
     * This can be a fixed boolean value, a shared condition ID (see AlNavigationSchema.conditions), or a condition literal. */
    visible?:AlRouteCondition|string|boolean;

    /* Does is match patterns other than its canonical href?  If so, list of patterns relative to the action's site (only applies to action.type == link) */
    matches?:string[];

    /* Nested menu items */
    children?:AlRouteDefinition[];

    /* Behavior inflection: if this item is enabled, enable the parent item and project into its href.  This is useful for top level menu items that should direct to a child route. */
    bubble?:boolean;

    /* Behavior inflection: menu item can be visible even if the user is not authenticated.  This depends on the routing host exposing a route parameter "anonymous" with the value "true". */
    isPublic?:boolean|null;

    /* Optional sub-route definitions.  If present, the first item whose `visible` conditions are met will have its `action` promoted into the main route definition. */
    options?: { visible?:AlRouteCondition|boolean, action:AlRouteAction|string }[];

    /* Optional behavior inflection for activatibility of this menu item:
     *
     * If the value "inert" is provided, this route is not activatable.
     * If the value "primary" is provided, it indicates that this route is the primary instance of a shared route that may be used in multiple places in
     * the navigational hierarchy.
     */
    activationRule?:"primary"|"inert";
}

/**
 * @private
 *
 * Utility class for menu tree refreshes and activation checks; mostly intended to avoid repetitive string manipulation :)
 */
class AlRouteIterationState {
    public depth: number = 0;
    public url:string;
    public urlNoParams:string;
    public urlAppRoot:string;
    public host:AlRoutingHost;

    constructor( public rootNode:AlRoute,
                 public resolve:boolean = false,
                 public truncateLocal?:boolean ) {
        if ( typeof this.truncateLocal === undefined ) {
            this.truncateLocal = !! AlRuntimeConfiguration.options.truncateLocalLinks;
        }
        this.host = rootNode.host;
        this.url = rootNode.host.currentUrl;
        let hashOffset = this.url.indexOf("#");
        if ( hashOffset > 0 && this.url[hashOffset - 1] !== '/' ) {
            //  This means that URLs for apps in subdirectories will work properly with both https://origin.com/subpath/#/some/route and https://origin.com/subpath#/some/route.
            this.url = this.url.substring(0,hashOffset) + "/" + this.url.substring( hashOffset );
        }
        this.urlNoParams = this.url.replace(/\?[^#]*/, '' );
        this.urlAppRoot = this.urlNoParams.replace(/#[^\?]*/, '' );
        if ( ! this.urlAppRoot.endsWith("/") ) {
            this.urlAppRoot += '/';     //  make sure we always have a trailing slash!
        }
    }
}

/**
 *  @public
 *
 *  An AlRoute is an instantiated route definition, attached to a routing host, and capable of actually calculating target URLs based on context
 *  and handling navigation events.
 */
export class AlRoute {
    public static debug:boolean = false;

    /* A global cache of compiled regexes for match checking */
    public static reCache:{[pattern:string]:RegExp|null} = {};

    /* The route's caption, echoed from its definition but possibly translated */
    caption:string;

    /* Is the menu item visible? */
    visible:boolean = true;

    /* Is the menu item enabled?  Disabled menu items and their children will not be considered for activation. */
    enabled:boolean = true;

    /* Is the menu item locked?  This prevents refresh cycles from changing its state. */
    locked:boolean = false;

    /* Is the menu item currently activated/expanded?  This will allow child items to be seen. */
    activated:boolean = false;

    /* Child menu items */
    children:AlRoute[] = [];

    /* Arbitrary properties */
    properties: {[property:string]:any} = {};

    /* Base of target URL */
    baseHREF?:string;

    /* Cached target URL */
    href?:string;

    constructor( public host:AlRoutingHost,                     /* Link to the routing host, which exposes current routing context, routing parameters, and actions that influence the environment */
                 public definition:AlRouteDefinition,           /* The raw data of the route */
                 public parent:AlRoute|undefined = undefined    /* Parent menu item (if not a top level navigational slot) */
    ) {
        this.definition =   definition;
        this.caption    =   definition.caption;
        if ( definition.bookmarkId ) {
            this.host.setBookmark( definition.bookmarkId, this );
        }
        if ( definition.children ) {
            for ( let i = 0; i < definition.children.length; i++ ) {
                this.children.push( new AlRoute( host, definition.children[i], this ) );
            }
        }
        if ( definition.properties ) {
            this.properties = Object.assign( this.properties, definition.properties );      //  definition properties provide the "starting point" for the route's properties, but remain immutable defaults
        }
        if ( parent === undefined ) {
            //  This effectively performs the initial refresh/state evaluation to occur once, after the top level item has finished populating
            this.refresh( true );
        }
    }

    /**
     * Generates an empty route attached to a null routing host
     */
    public static empty() {
        return new AlRoute( AlNullRoutingHost, { caption: "Empty", properties: {} } );
    }

    public static link( host:AlRoutingHost, locationId:string, path:string, caption:string = "Link" ) {
        return new AlRoute( host, {
            caption,
            action: {
                type: "link",
                location: locationId,
                path: path
            },
            properties: {} } );
    }

    public static trigger( host:AlRoutingHost, triggerName:string, caption:string = "Trigger" ) {
        return new AlRoute( host, {
            caption,
            action: {
                type: "trigger",
                trigger: triggerName
            },
            properties: {} } );
    }

    /**
     * Sets an arbitrary property for the route
     */
    setProperty( propName:string, value:any ) {
        if ( value === undefined ) {
            this.deleteProperty( propName );
        } else {
            this.properties[propName] = value;
        }
    }

    /**
     * Deletes a property.  If the immutable route definition contains the same property, it will be
     * restored.
     */
    deleteProperty( propName:string ) {
        if ( this.definition.properties && this.definition.properties.hasOwnProperty( propName ) ) {
            this.properties[propName] = this.definition.properties[propName];
        } else {
            delete this.properties[propName];
        }
    }

    /**
     * Retrieves a property.
     */
    getProperty( propName:string, defaultValue:any = null ):any {
        return this.properties.hasOwnProperty( propName ) ? this.properties[propName] : defaultValue;
    }

    /**
     * Refreshes the state of a given route.  Internal refresh should be considered an extension of this method; the outer function
     * simply wraps the tree iteration process in exception handling.
     *
     * @param resolve - If true, forces the calculated href and visibility properties to be recalculated.
     * @param truncateLocalURLs - If true, removes all but the anchor fragment of URLs on the "acting" node
     *
     * @returns Returns true if the route (or one of its children) is activated, false otherwise.
     */
    refresh( resolve:boolean = false, truncateLocalURLs?:boolean ) {
        try {
            let state = new AlRouteIterationState( this, resolve, truncateLocalURLs );
            this.internalRefresh( state );
        } catch( e ) {
            console.error(`Navigation Error: could not refresh menu: `, e );
        }
    }

    internalRefresh( state:AlRouteIterationState ):boolean|undefined {
        if ( this.locked ) {
            //  If this menu item has been locked, then we won't reevaluate its URL, its visibility, or its activated status.
            //  This lets outside software take "manual" control of the state of a given menu.
            return;
        }

        if ( this.definition.enabled ) {
            this.enabled = this.evaluateCondition( this.definition.enabled );
            if ( ! this.enabled ) {
                this.visible = false;
                //  This item and its family tree are disabled, and thus not considered for visibility or activation.
                return;
            }
        }

        state.depth++;

        /* Evaluate visibility */
        this.visible = true;        //  true until proven otherwise
        if ( this.parent ) {
            if ( typeof( this.definition.isPublic ) !== "boolean" && this.parent ) {
                //  Selectively inherit parent's publicity specificer (null|true|false|undefined)
                this.definition.isPublic = this.parent.definition.isPublic;
            }
        }

        if ( "anonymous" in this.host.routeParameters ) {
            if ( this.host.routeParameters.anonymous === "true" && typeof( this.definition.isPublic ) === 'boolean' ) {
                //  If the current user is anonymous/unauthenticated and this route isn't public (undefined or null), then set visible to false
                //  Important note: `null` does not trigger this logic, and the top route of each menu always has this property set to `null`.
                this.visible = this.definition.isPublic;
            } else if ( this.host.routeParameters.anonymous === "false" && this.definition.isPublic ) {
                //  If the current user is authenticated and this route is public ONLY (boolean true), then this route should not be visible
                this.visible = false;
            }
        }
        if ( this.visible ) {
            if ( typeof( this.definition.options ) !== 'undefined' ) {
                this.visible = this.visible && this.evaluateRouteOptions();
            } else {
                this.visible = this.visible && ( this.definition.hasOwnProperty( 'visible' ) ? this.evaluateCondition( this.definition.visible || false ) : true );
            }
        }

        /* Evaluate children recursively, and deduce activation state from them. */
        let childActivated = this.children.reduce( ( activated, child ) => child.internalRefresh( state ) || activated, false );

        /* Evaluate fully qualified href, if visible/relevant */
        let action:AlRouteAction|null = this.getRouteAction();
        if ( action ) {
            if ( this.visible && ( state.resolve || this.href === null ) && action.type === 'link' ) {
                if ( ! this.evaluateHref( state, action ) ) {
                    state.depth--;
                    return this.disable();
                }
            }
        }

        this.activated = childActivated;

        //  activation test for path match
        if ( ! this.activated ) {
            this.evaluateActivation( state );
        }

        //  bubble route?  if so, push calculated activation/visibility/route state to parent.
        //  useful note: this property works in a nested fashion, so grandchild elements can bubble up to their
        //  grandparents if the parent/child node between them also has `bubble` set to true.
        if ( this.definition.bubble && this.parent ) {
            this.parent.activated = this.parent.activated || this.activated;
            this.parent.visible = this.parent.visible || this.visible;
            this.parent.href = this.href;
        }

        state.depth--;
        return this.activated;
    }

    evaluateRouteOptions():boolean {
        if ( typeof( this.definition.options ) === 'undefined' ) {
            return false;
        }
        const activatedOption = this.definition.options.find( option => {
            if ( typeof( option.visible ) === 'undefined' ) {
                return true;
            }
            if ( typeof( option.visible ) === 'boolean' ) {
                return option.visible;
            }
            return this.evaluateCondition( option.visible || false );
        } );
        if ( ! activatedOption ) {
            return false;
        }
        this.definition.action = activatedOption.action;
        return true;
    }

    /**
     * Disables a route
     */
    disable():boolean {
        this.activated = false;
        this.visible = false;
        return false;
    }

    /**
     * "Executes" a route.  This invokes the `dispatch` method on whatever routing host was provided to the menu at load time.
     */
    dispatch() {
        this.refresh( true );
        return this.host.dispatch( this );
    }

    /**
     * Retrieves the full URL for a route, if applicable.
     */
    toHref( truncateLocalURLs?:boolean ) {
        this.refresh( true, truncateLocalURLs );
        return this.href;
    }

    /**
     * Diagnostic method for logging the current hierarchy and state of a given navigational tree.  Excluded from unit test coverage because no production code should utilize it!
     */
    /* istanbul ignore next */
    summarize( showAll:boolean = true, depth:number = 0 ):string {
        let response:string = '';
        if ( showAll || this.visible ) {
            response += "    ".repeat( depth ) + ( depth > 0 ? `- ` : '' );
            response += `[${this.definition.caption}] (${this.visible ? 'visible' : 'hidden'}, ${this.activated ? 'activated' : 'inactive'})` + ( this.href ? ' - ' + this.href : '' );
            response += "\n";
            for ( let i = 0; i < this.children.length; i++ ) {
                response += this.children[i].summarize( showAll, depth + 1 );
            }
        }
        return response;
    }

    /**
     *---- Helper Methods ---------------------------------------------
     */

    /**
     * Evaluates the HREF for an route with action type 'link'
     */
    evaluateHref( state:AlRouteIterationState, action:AlRouteAction ):boolean {
        if ( action.url ) {
            this.href = action.url;
            return true;
        }
        if( !action.location ){
            console.warn(`Warning: cannot link to undefined location in menu item '${this.caption}` );
            return false;
        }
        const node = AlLocatorService.getNode( action.location );
        if ( ! node ) {
            console.warn(`Warning: cannot link to unknown location '${action.location}' in menu item '${this.caption}` );
            return false;
        }

        this.baseHREF = node.uri.replace( /[ \/]+$/g, '' );
        let path = action.path ?? '';
        let missing = false;
        //  Substitute route parameters into the path pattern; fail on missing required parameters,
        //  ignore missing optional parameters (denoted by percentage sign), and trim any trailing slashes and spaces.
        path = path.replace( /:[a-zA-Z_%]+/g, match => {
                let variableId = match.substring( 1 );
                let required = true;
                if ( variableId[variableId.length-1] === '%' ) {
                    required = false;
                    variableId = variableId.substring( 0, variableId.length - 1 );
                }
                if ( this.host.routeParameters.hasOwnProperty( variableId ) ) {
                    return this.host.routeParameters[variableId];
                } else if ( required ) {
                    missing = true;
                    return `:${variableId}`;
                } else {
                    return '';
                }
            } )
            .replace( /[ \/]+$/g, '' );     //  remove all spaces and trailing slashes

        this.href = this.baseHREF + path;
        if ( this.host.decorateHref ) {
            this.host.decorateHref( this );
        }
        if ( state.truncateLocal && state.urlAppRoot && this.href.startsWith( state.urlAppRoot ) ) {
            //  "Local" mode will emit URLs composed solely of anchor fragments for routes on the active app's domain
            this.href = this.href.substring( state.urlAppRoot.length );
        }
        return ! missing;
    }

    /**
     * Evaluates the activation state of the route
     */
    evaluateActivation( state:AlRouteIterationState ):boolean {
        if ( this.definition.activationRule === 'inert' || ! this.href ) {
            //  Not a candidate for activation
            return false;
        }
        if ( this.baseHREF && state.url.startsWith( this.baseHREF ) ) {
            const noParamsHref = this.href.includes('?') ? this.href.substring(0, this.href.indexOf('?')) : this.href;
            if ( state.urlNoParams === noParamsHref ) {
                //  If our full URL *contains* the current URL, we are activated
                if ( AlRoute.debug ) {
                    console.log("Navigation: activating route [%s] based on exact path match", this.definition.caption, state.urlNoParams, this.definition );
                }
                this.activated = true;
            } else if ( this.definition.matches ) {
                //  If we match any other match patterns, we are activated
                let matchedPattern = this.definition.matches.find( matchPattern => {
                    if ( ! ( matchPattern in AlRoute.reCache ) ) {
                        try {
                            const normalized = `^${this.baseHREF}${matchPattern}$`.replace("/", "\\/" );
                            AlRoute.reCache[matchPattern] = new RegExp( normalized );
                        } catch( e ) {
                            console.warn( `Warning: invalid navigation match pattern '${matchPattern}' cannot be compiled as a regular expression; ignoring.` );
                            AlRoute.reCache[matchPattern] = null;
                        }
                    }
                    let regexp = AlRoute.reCache[matchPattern];
                    return regexp ? regexp.test( state.urlNoParams ) : false;
                } );
                if ( matchedPattern ) {
                    if ( AlRoute.debug ) {
                        console.log(`Navigation: activating route [%s] based on regular expression match [%s]`, this.definition.caption, matchedPattern, this.definition );
                    }
                    this.activated = true;
                }
            }
        }
        return this.activated;
    }

    /**
     *  Evaluates an AlRouteCondition recursively.
     *
     *  Internally, the methods compiles boolean results of
     *      a) nested conditions
     *      b) route parameters or parameter expressions
     *      c) path matches
     *      d) entitlements or other externally calculated conditions
     *  And then uses a simple reducer to roll up all results based on the condition rule, which defaults to 'all'.
     */
    evaluateCondition( condition:AlRouteCondition|string|boolean ):boolean {
        if ( typeof( condition ) === 'string' ) {
            condition = this.host.getConditionById( condition );
        }
        if ( typeof( condition ) === 'boolean' ) {
            return condition;
        }
        if ( typeof( condition ) !== 'object' || condition === null ) {
            return false;
        }

        let evaluations:boolean[] = [];
        if ( condition.rule && condition.conditions ) {
            evaluations = evaluations.concat( condition.conditions.map( condition => this.evaluateCondition( condition ) ) );
        }

        if ( condition.parameters ) {
            evaluations = evaluations.concat( condition.parameters.map( parameterExpression => this.evaluateParameterExpression( parameterExpression ) ) );
        }
        if ( condition.path_matches ) {
            //  Evaluates true only if the current path matches a given regular expression
            evaluations.push( this.evaluatePathMatch( condition.path_matches ) );
        }
        if ( condition.authentication
                || condition.accounts || condition.primaryAccounts
                || condition.entitlements || condition.primaryEntitlements
                || condition.accountProps || condition.primaryAccountProps
                || condition.environments
                || condition.experiences ) {
            //  This condition refers to entitlement or other externally managed data -- ask the host to evaluate it.
            evaluations = evaluations.concat( this.host.evaluate( condition ) );
        }
        if ( condition.rule === 'none' ) {
            return ! evaluations.some( value => value );        //  no items are true
        } else if ( condition.rule === 'any' ) {
            return evaluations.some( value => value );          //  any items are true
        } else /* all conditions */ {
            return evaluations.every( value => value );         //  all items are true
        }
    }

    /**
     * Determine whether a route parameter test is true or not
     */
    evaluateParameterExpression( expression:string ) {
        if ( expression.includes("!=") ) {
            const [ parameterName, parameterValue ] = expression.split("!=");
            return ! this.host.routeParameters.hasOwnProperty( parameterName ) || this.host.routeParameters[parameterName] !== parameterValue;
        } else if ( expression.includes("=") ) {
            const [ parameterName, parameterValue ] = expression.split("=");
            return this.host.routeParameters.hasOwnProperty( parameterName ) && this.host.routeParameters[parameterName] === parameterValue;
        } else {
            return this.host.routeParameters.hasOwnProperty( expression );
        }
    }

    /**
     * Determines whether a path pattern matches the current URL
     */
    evaluatePathMatch( pathMatches:string ) {
        let pattern = "^.*" + pathMatches.replace(/[{}|[\]\\\/]/g, '\\$&') + "$";
        let comparison = new RegExp( pattern );
        return comparison.test( this.host.currentUrl );
    }

    /**
     * Retrieves the route's action, which may be a shared "named" route or embedded directly into the route's definition.
     */
    getRouteAction():AlRouteAction|null {
        if ( typeof( this.definition.action ) === 'string' ) {
            if ( typeof( this.host.getRouteByName ) === 'function' ) {
                const definition:AlRouteDefinition = this.host.getRouteByName( this.definition.action );
                if ( definition && definition.action ) {
                    return definition.action as AlRouteAction;
                }
            }
            return null;
        } else if ( typeof( this.definition.action ) === 'object' ) {
            return this.definition.action;
        }
        return null;
    }

    /**
     * Updates the route to use a specified action
     */
    setAction( action:AlRouteAction ) {
        this.definition.action = action;
    }

    /**
     * Updates the route to use a specific callback action.
     */
    setCallback( callback?:{(route:AlRoute,mouseEvent?:any):void} ) {
        this.setAction( {
            type: 'callback',
            callback: callback
        } );
    }

    /**
     * Retrieves a nested child route by matching bookmarks, captions, IDs, or numerical indices.
     */
    findChild( idPath:string|string[] ):AlRoute|null {
        const path = typeof( idPath ) === 'string' ? idPath.split("/") : idPath;
        const childId = path[0];
        let child:AlRoute|null|undefined = null;

        if ( childId[0] === '#' ) {
            //  Retrieve by numerical index
            let childIndex = parseInt( childId.substring( 1 ), 10 );
            child = this.children.length > childIndex ? this.children[childIndex] : null;
        } else {
            if ( typeof( idPath ) === 'string' ) {
                child = this.host.getBookmark( childId );
            }
            if ( ! child ) {
                child = this.children ? this.children.find( child => child.definition.caption === childId || child.definition.id === childId ) : null;
            }
        }
        if ( path.length > 1 ) {
            return child ? child.findChild( path.slice( 1 ) ) : null;
        }
        return child || null;
    }

    /**
     * Generic method for recursing a menu hierarchy, using a callback to match the route.
     *
     * @param callback is a method that accepts a route (and optionally its definition) and returns
     *          `true` if the route is the correct one, in which case it is the result of the search method.
     *          `false` if the route is incorrect but its children should be iterated.
     *          `null` if the route is incorrect and its children should be ignored
     */
    search( matcher:{(route:AlRoute, definition?:AlRouteDefinition):boolean}, enabledOnly:boolean = true ):AlRoute|undefined {
        if ( this.enabled !== enabledOnly ) {
            return;
        }
        if ( matcher( this, this.definition ) ) {
            return this;
        } else {
            for ( let i = 0; i < this.children.length; i++ ) {
                let target = this.children[i].search( matcher, enabledOnly );
                if ( target ) {
                    return target;
                }
            }
        }
    }

    /**
     * This method will return the deepest activated, childless route within its first activated child.  If this sounds obtuse,
     * it is -- but's it's important for determining the "cursor" menu item within a menu hierarchy.
     */
    getActivationCursor():AlRoute|undefined {
        let activatedChild:AlRoute|undefined = undefined;
        this.children.find( child => {
            if ( child.activated ) {
                if ( child.children.length === 0 ) {
                    activatedChild = child;
                } else {
                    activatedChild = child.getActivationCursor();
                }
            }
            return activatedChild ? true : false;
        } );

        if ( activatedChild ) {
            return activatedChild;
        }

        return this.activated ? this : undefined;
    }

    /**
     * This method uses the method above to generate a flat array of activated menu items, from top to bottom,
     * or undefined if no child of the given menu is activated.
     */
    getActivationCursorFlat():AlRoute[]|undefined {
        let cursor = this.getActivationCursor();
        if ( ! cursor ) {
            return undefined;
        }
        let activationPath:AlRoute[] = [];
        while( cursor ) {
            activationPath.unshift( cursor );
            cursor = cursor.parent;
        }
        return activationPath;
    }
}
