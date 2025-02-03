/**
 * @public
 *
 * AlLocationContext defines the context in which a specific location or set of locations may exist.
 *     - environment - development, integration, production?
 *     - residency - US or EMEA (or default)?
 *     - insightLocationId - insight-us-virginia, insight-eu-ireland, defender-us-ashburn, defender-us-denver, defender-uk-newport
 *     - accessible - a list of accessible insight location IDs
 */
export interface AlLocationContext {
    environment?:string;
    residency?:string;
    insightLocationId?:string;
    path?:string;
    accessible?:string[];
}

/**
 * @public
 *
 * Describes a location
 */

export interface AlLocationDescriptor
{
    locTypeId:string;               //  This should correspond to one of the ALLocation string constants, e.g., AlLocation.AccountsUI or AlLocation.GlobalAPI.
    insightLocationId?:string;      //  The location ID as defined by the global locations service -- e.g., 'defender-us-ashburn' or 'insight-eu-ireland'.
    uri:string;                     //  URI of the entity
    residency?:string;              //  A data residency domain
    environment?:string;            //  'production, 'integration', 'development'...
    aliases?:string[];              //  A list of
    external?:boolean;              //  Indicates a location that can be linked to but which we will never be executing within
    data?:any;                      //  Miscellaneous associated data
    magmaRedirectPath?: string;
}
