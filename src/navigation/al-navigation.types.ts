/**
 *  This is a collection of interfaces and types for navigation constructs that don't fit into other categories.
 *
 *  Author: McNielsen <knielsen@alertlogic.com>
 *  Copyright 2020 Alert Logic Inc.
 */

import { AlRouteDefinition, AlRouteCondition, AlRouteAction } from './al-route.types';

/**
 * @public
 *
 * This is a top-level interface for the structure of a schema document, which is a set of compiled menus and behavioral rules.
 */
export interface AlNavigationSchema
{
    name: string;
    description: string;
    menus: {[menuId:string]:AlRouteDefinition};
    namedRoutes: {[routeName:string]:AlRouteDefinition};
    conditions: {[conditionId:string]:AlRouteCondition};
}

/**
 * The unique members of this class have been consolidated into AlRouteCondition, leaving this interface a hollow shell.
 * Don't use it; it will be deprecated and removed in future versions.
 */
export interface AlExperienceToggle extends AlRouteCondition {
}

/**
 * Describes the entry location, availability criteria, and prompt behaviors of a specific experience (for the purposes of this
 * type, and "experience" = a specific variation or common subset of a feature.
 */
export interface AlExperienceMapping
{
    /*
     * A descriptive name for the experience
     */
    name:string;

    /**
     * A route or trigger that can be used to imperatively invoke the experience
     */
    entryRoute:AlRouteAction;

    /**
     * May be a boolean, a route condition, or an array of route conditions that determine when this experience should be enabled.
     */
    trigger:AlRouteCondition|AlRouteCondition[]|boolean;

    /**
     * If present and true, indicates the user can opt in or out of this experience, and their opt-in status should be "sticky."
     */
    optional?:boolean;

    /**
     * If provided, defines the zero state to provide when an experience isn't available.
     */
    unavailable?: {
        title:string|boolean;
        description:string|boolean;
        iconClass?:string;
        iconText?:string;
    };

    /**
     * Describes how related complementary/alternative experiences should be cross-referenced from this one.
     */
    crosslink?: {
        experienceId:string;
        strategy:"reroute"|"trigger"|"above-content";
        caption:string;
        trigger:string;
    }[];
}

