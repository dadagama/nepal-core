import { AlLocatorService, AlRoute } from '../navigation';
import { AlLocationContext } from '../abstract';

/**
 * Describes a set of paths where specific query parameters should be preserved across navigation events, or removed when
 * navigation outside of the application area occurs.
 */
export interface AlParamPreservationRule {
    /**
     * One or more regexes describing logical paths to which these particular rules should be applied
     */
    applyTo:RegExp[];

    /**
     * Query parameters that should be preserved across requests
     */
    whitelist?:string[];

    /**
     * Query parameters that should be destroyed when navigating to a non-matching path
     */
    volatile?:string[];
}

/**
 * Provides a single interface to control different behaviors across Alert Logic's UI surface area.
 * Many of these are used by the navigation and generic component libraries.
 *
 *   - ConfigOption.GestaltAuthenticate - if true, indicates that AlSession should authenticate via gestalt's session proxy; otherwise,
 *      authentication is performed directly against global AIMS.  Defaults to false.
 *
 *   - ConfigOption.GestaltDomain - If the GestaltAuthenticate option is enabled, this indicates which application will proxy requests to gestalt.
 *
 *   - ConfigOption.ResolveAccountMetadata - if true, AlSession's `setActingAccount` method will retrieve metadata (entitlements and account details)
 *      for the primary and acting account before resolving.  Otherwise, `setActingAccount` will resolve immediately.  Defaults to `true`.
 *
 *   - ConfigOption.ConsolidatedAccountResolver - if true and account metadata resolution is enabled, gestalt's consolidated resolver endpoint
 *      will be used instead of individual calls to subscriptions and AIMS.  Defaults to false.
 *
 *   - ConfigOption.LocalManagedContent - controls whether AlExternalContentManagerService (@al/ng-generic-components) retrieves static content
 *      from gestalt's content endpoints, or attempts to retrieve it from local assets.  Defaults to 'false.'  This is mostly useful for testing
 *      purposes.
 *
 *   - ConfigOption.ManagedContentAssetPath - if local managed content is enabled, indicates the base path to retrieve static content from.
 *
 *   - ConfigOption.NavigationViaConduit - if enabled, AlNavigationService will attempt to retrieve navigation metadata from a conduit request
 *      (which queries console.account for a static asset).  Defaults to 'false.'
 *
 *   - ConfigOption.NavigationViaGestalt - if enabled, AlNavigationService will attempt to retrieve navigation metadata from gestalt
 *      (via AlExternalContentManagerService).  Defaults to 'true.'
 *
 *   - ConfigOption.NavigationAssetPath - if neither conduit nor gestalt navigation options are enabled, AlNavigationService falls back to retrieving
 *      local navigation metadata.  Defaults to 'assets/navigation'.
 *
 *   - ConfigOption.NavigationDefaultAuthState - tristate option indicates whether the default navigation state of the app is
 *      true (user must be authenticated to access), false (no session is required to access), or `null`, in which case the authentication property
 *      of navigational structures is used to determine which navigational options are available.  Defaults to 'null.'
 *
 *   - ConfigOption.NavigationDiagnostics - when enabled, causes the navigation layer to emit "helpful" commentary.
 *
 *   - ConfigOption.Headless and ConfigOption.ActingURI are provided to support angular universal pre-rendering, where there is no DOM
 *      and no browser context, but the libraries need to be marshalled as though there were.
 */

export interface AlContextOptions {
    gestaltLocationId?:string;
    conduitLocationId?:string;
    noGestaltAuthentication?:boolean;
    noConduit?:boolean;
    noAccountMetadata?:boolean;
    noEndpointsResolution?:boolean;
    localManagedContent?:string;
    headless?:boolean;
    embeddedFortraApp?:boolean;
    externalConduitIFrame?:string;
    defaultAccountId?:string;
    truncateLocalLinks?:boolean;
    resourceBaseUrl?:string;
}

/**
 *
 */
export class AlRuntimeConfiguration {

    public static options:AlContextOptions = {};
    protected static paramPreservationZones:{[zoneKey:string]:AlParamPreservationRule} = {};

    public static setContext( environment:string, residency:"US"|"EMEA" = "US", locationId?:string ) {
        let context:AlLocationContext = { environment, residency };
        if ( locationId ) {
            context.insightLocationId = locationId;
        }
        AlLocatorService.setContext( context );
        AlRoute.reCache = {};
    }

    public static reset() {
        AlRuntimeConfiguration.options = {};
        AlRoute.reCache = {};
    }

    public static remapLocation( locationTypeId:string, baseURL:string, environment?:string, residency?:string ) {
        AlLocatorService.remapLocationToURI( locationTypeId, baseURL, environment, residency );
        AlRoute.reCache = {};
    }

    /**
     *  To run an application with local static content, run ui-static-content's build script, copy the entire `dist` folder into your application's
     *  src/assets/external, and then invoke this function.  The path can be overridden, of course!
     */
    public static useLocalContent( assetBasePath:string = 'assets/external' ) {
        AlRuntimeConfiguration.options.localManagedContent = assetBasePath;
        AlRuntimeConfiguration.options.noGestaltAuthentication = true;
        AlRuntimeConfiguration.options.noConduit = true;
    }

    /**
     * Sets the map of parameter preservation rules for consumption by the navigation layer.
     */
    public static setParamPreservationRules( rulesMap: { [zoneKey: string]: AlParamPreservationRule } ) {
        for (const [zoneKey, rule] of Object.entries(rulesMap)) {
            AlRuntimeConfiguration.paramPreservationZones[zoneKey] = rule;
        }
    }

    /**
     * Saves a parameter preservation rule for consumption by the navigation layer.
     */
    public static addParamPreservationRule( zoneKey:string, rule:AlParamPreservationRule ) {
        AlRuntimeConfiguration.paramPreservationZones[zoneKey] = rule;
    }

    /**
     * Removes a parameter preservation rule
     */
    public static removeParamPreservationRule( zoneKey:string ) {
        delete AlRuntimeConfiguration.paramPreservationZones[zoneKey];
    }

    /**
     * Finds the parameter preservation rule that should apply to a given path (used by navigation layer)
     */
    public static findParamPreservationRule( path:string ):AlParamPreservationRule|null {
        return Object.values( AlRuntimeConfiguration.paramPreservationZones )
                    .find( zone => zone.applyTo.some( pathMatcher => pathMatcher.test( path ) ) );
    }
}
