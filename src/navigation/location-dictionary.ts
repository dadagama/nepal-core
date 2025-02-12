import { AlLocationDescriptor } from '../abstract';
import { AlLocation } from './constants';

/**
 * @public
 *
 * A dictionary of public Alert Logic resource locations, subkeyed by residency and environment.
 */
/* tslint:disable:variable-name */
export const AlLocationDictionary: AlLocationDescriptor[] =
[
    ...AlLocation.magmaNode(AlLocation.MagmaUI, 'magma', 8888 ),
    ...AlLocation.o3Node(AlLocation.AccountsUI, 'account', 8002),
    ...AlLocation.o3Node(AlLocation.OverviewUI, 'overview', 4213),
    ...AlLocation.o3Node(AlLocation.IncidentsUI, 'incidents', 8001),
    ...AlLocation.o3Node(AlLocation.IntelligenceUI, 'intelligence', 4211),
    ...AlLocation.o3Node(AlLocation.ConfigurationUI, 'configuration', 4210),
    ...AlLocation.o3Node(AlLocation.RemediationsUI, 'remediations', 4212),
    ...AlLocation.o3Node(AlLocation.SearchUI, 'search', 4220),
    ...AlLocation.o3Node(AlLocation.EndpointsUI, 'endpoints', 8004),
    ...AlLocation.o3Node(AlLocation.DashboardsUI, 'dashboards', 7001),
    ...AlLocation.o3Node(AlLocation.HealthUI, 'health', 8003),
    ...AlLocation.o3Node(AlLocation.ExposuresUI, 'exposures', 8006),
    ...AlLocation.o3Node(AlLocation.LandscapeUI, 'landscape', 4230),

    /**
     * Static Content Origins
     */
    {
        locTypeId: AlLocation.StaticContentUI,
        uri: 'https://console.magma.product.dev.alertlogic.com',
        environment: 'development|integration|embedded-development|embedded-integration',
        external: true
    },
    {
        locTypeId: AlLocation.StaticContentUI,
        uri: 'https://console.alertlogic.com',
        environment: 'production|production-staging',
        external: true
    },

    /**
    *  Global APIs
    */
    {
        locTypeId: AlLocation.GlobalAPI,
        insightLocationId: 'insight-global',
        uri: 'https://api.global.alertlogic.com',
        environment: 'production|production-staging',
        external: true
    },
    {
        locTypeId: AlLocation.GlobalAPI,
        insightLocationId: 'insight-global',
        uri: 'https://api.global-integration.product.dev.alertlogic.com',
//        environment: 'integration|development|embedded-development|embedded-integration',
        environment: 'integration|development',
        external: true
    },
    {
        locTypeId: AlLocation.GlobalAPI,
        insightLocationId: 'insight-global',
        uri: 'https://api.global.xdr.foundation-stage.cloudops.fortradev.com',
        environment: 'embedded-integration',
        external: true
    },
    {
        locTypeId: AlLocation.GlobalAPI,
        insightLocationId: 'insight-global',
        uri: 'https://api.global.xdr.foundation-dev.cloudops.fortradev.com',
        environment: 'embedded-development|embedded-integration',
        external: true
    },

    /**
    *  Cloud Insight API locations
    */
    {
        locTypeId: AlLocation.InsightAPI,
        uri: 'https://api.cloudinsight.alertlogic.com',
        environment: 'production|production-staging',
        residency: 'US',
    },
    {
        locTypeId: AlLocation.InsightAPI,
        uri: 'https://api.cloudinsight.alertlogic.co.uk',
        environment: 'production|production-staging',
        residency: 'EMEA',
    },
    {
        locTypeId: AlLocation.InsightAPI,
        uri: 'https://api.product.dev.alertlogic.com',
//        environment: 'integration|development|embedded-integration|embedded-development',
        environment: 'integration|development',
        residency: 'US',
    },
    {
        locTypeId: AlLocation.InsightAPI,
        uri: 'https://api.xdr.foundation-stage.cloudops.fortradev.com',
        environment: 'embedded-integration',
        residency: 'US',
    },
    {
        locTypeId: AlLocation.InsightAPI,
        uri: 'https://api.xdr.foundation-dev.cloudops.fortradev.com',
        environment: 'embedded-development',
        residency: 'US',
    },

    /**
     * Gestalt api API locations
     */
    {
        locTypeId: AlLocation.GestaltAPI,
        uri: 'https://gestalt-api.product.dev.alertlogic.com',
        environment: 'integration|development|embedded-integration|embedded-development'
    },
    {
        locTypeId: AlLocation.GestaltAPI,
        uri: 'https://gestalt.cloudinsight.alertlogic.co.uk',
        environment: 'production|production-staging',
        residency: 'EMEA'
    },
    {
        locTypeId: AlLocation.GestaltAPI,
        uri: 'https://gestalt.cloudinsight.alertlogic.com',
        environment: 'production|production-staging',
        residency: 'US'
    },

    /**
    *  CD14 UI locations.
    */
    {
        locTypeId: AlLocation.LegacyUI,
        insightLocationId: 'defender-us-denver',
        uri: 'https://console.clouddefender.alertlogic.com',
        environment: 'production|production-staging',
        residency: 'US',
    },

    {
        locTypeId: AlLocation.LegacyUI,
        insightLocationId: 'defender-uk-newport',
        uri: 'https://console.alertlogic.co.uk',
        environment: 'production|production-staging',
        residency: 'EMEA',
    },

    {
        locTypeId: AlLocation.LegacyUI,
        insightLocationId: 'defender-us-ashburn',
        uri: 'https://console.alertlogic.net',
        environment: 'production|production-staging',
        residency: 'US',
    },

    {
        locTypeId: AlLocation.LegacyUI,
        insightLocationId: 'defender-us-ashburn',
        uri: 'https://cd-integration-console.alertlogic.net',
        environment: 'integration|development|embedded-integration|embedded-development',
        residency: 'US',
    },


    /**
    *  Insight BI
    */
    {
        locTypeId: AlLocation.InsightBI,
        uri: 'https://bi.cloudinsight.alertlogic.com',
        environment: 'production|production-staging',
        residency: 'US'
    },
    {
        locTypeId: AlLocation.InsightBI,
        uri: 'https://bi.cloudinsight.alertlogic.co.uk',
        environment: 'production|production-staging',
        residency: 'EMEA'
    },
    {
        locTypeId: AlLocation.InsightBI,
        uri: 'https://bi.product.dev.alertlogic.com',
        environment: 'integration|development|embedded-integration|embedded-development'
    },

    /**
    *  Hud UI
    */
    {
        locTypeId: AlLocation.HudUI,
        uri: 'https://hud.iris.alertlogic.com',
        aliases: [
            'https://hud.iris.alertlogic.co.uk'
        ],
        environment: 'production',
        residency: 'US'
    },
    {
        locTypeId: AlLocation.HudUI,
        uri: 'https://hud-ui-production-staging-us.ui-dev.product.dev.alertlogic.com',
        aliases: [
            'https://hud-ui-production-staging-uk.ui-dev.product.dev.alertlogic.com'
        ],
        environment: 'production-staging',
        residency: 'US'
    },
    {
        locTypeId: AlLocation.HudUI,
        uri: 'https://console.hudui.product.dev.alertlogic.com',
        environment: 'integration',
        aliases: [
            `https://hud-ui.ui-dev.product.dev.alertlogic.com`,
            `https://hud-ui-*.ui-dev.product.dev.alertlogic.com`,
            `https://hud-ui-pr-*.ui-dev.product.dev.alertlogic.com`,
        ]
    },
    {
        locTypeId: AlLocation.HudUI,
        uri: 'http://localhost:4200',
        environment: 'development',
    },

    /**
    *  Iris UI
    */
    {
        locTypeId: AlLocation.IrisUI,
        uri: 'https://console.iris.alertlogic.com',
        aliases: [ 'https://console.iris.alertlogic.co.uk' ],
        environment: 'production',
        residency: 'US',
    },
    {
        locTypeId: AlLocation.IrisUI,
        uri: 'https://iris-ui-production-staging-us.ui-dev.product.dev.alertlogic.com',
        aliases: [
            'https://iris-ui-production-staging-uk.ui-dev.product.dev.alertlogic.com'
        ],
        environment: 'production-staging',
        residency: 'US',
    },
    {
        locTypeId: AlLocation.IrisUI,
        uri: 'https://iris.product.dev.alertlogic.com',
        environment: 'integration',
        aliases: [
            `https://iris-ui.ui-dev.product.dev.alertlogic.com`,
            `https://iris-ui-*.ui-dev.product.dev.alertlogic.com`,
            `https://iris-ui-pr-*.ui-dev.product.dev.alertlogic.com`,
        ],
    },
    {
        locTypeId: AlLocation.IrisUI,
        uri: 'http://localhost:4202',
        environment: 'development',
    },

    /**
     * Barkly Endpoints API
     */
    {
        locTypeId: AlLocation.EndpointsAPI,
        uri: 'https://api.endpoints.alertlogic.com',
        environment: 'production|production-staging',
        residency: 'US'
    },
    {
        locTypeId: AlLocation.EndpointsAPI,
        uri: 'https://api.endpoints.alertlogic.co.uk',
        environment: 'production|production-staging',
        residency: 'EMEA'
    },
    {
        locTypeId: AlLocation.EndpointsAPI,
        uri: 'https://api.endpoints.product.dev.alertlogic.com',
        environment: 'integration|development|embedded-development|embedded-integration'
    },

    /**
    *  Integrations/API Documentation.
    */
    {
        locTypeId: AlLocation.IntegrationsUI,
        uri: 'http://localhost:8040',
        environment: 'development'
    },
    /**
    *  Fino!
    */
    {
        locTypeId: AlLocation.Fino,
        uri: 'https://den-fino.clouddefender.alertlogic.com'
    },

    /**
    *  Security Content Center!
    */
    {
        locTypeId: AlLocation.SecurityContent,
        uri: 'https://scc.alertlogic.net/'
    },

    {
        locTypeId: AlLocation.SupportPortal,
        uri: 'https://support.alertlogic.com'
    },

    /**
    *  Segment Configuration
    */
    {
        locTypeId: AlLocation.Segment,
        uri: 'https://segment.io',
        data: {
            analyticsKey: 'Ud9VX1aFxXgjg8CnlOBv9k5b6qga9yII'
        },
        environment: 'production|production-staging',
        residency: 'US'
    },
    {
        locTypeId: AlLocation.Segment,
        uri: 'https://segment.io',
        data: {
            analyticsKey: 'IwB7SmcEFckM6FrHlbQYcg0I75lc93dO'
        },
        environment: 'production',
        residency: 'EMEA'
    },
    {
        locTypeId: AlLocation.Segment,
        uri: 'https://segment.io',
        data: {
            analyticsKey: 'OXe8LjJ0C48IJASuW9Ho37f4o6XCXHIV'
        },
        environment: 'integration'
    },
    {
        locTypeId: AlLocation.Segment,
        uri: 'https://dev.segment.io',
        data: {
            analyticsKey: 'b1ptaDZMJSUaFmm38ho7p4NH5uHwqheY'
        },
        environment: 'development'
    },

    /**
    *  Google Tag Manager Config
    */
    {
        locTypeId: AlLocation.GoogleTagManager,
        uri: 'https://www.googletagmanager.com/gtag/js',
        data: {
            analyticsKey: 'UA-17359898-12',
            containerId: ''
        },
        environment: 'production|production-staging'
    },
    {
        locTypeId: AlLocation.GoogleTagManager,
        uri: 'https://www.googletagmanager.com/gtag/js',
        data: {
            analyticsKey: 'UA-17359898-11',
            containerId: 'GTM-KJZM6BQ'
        },
        environment: 'integration'
    },
    {
        locTypeId: AlLocation.GoogleTagManager,
        uri: 'https://www.googletagmanager.com/gtag/js',
        data: {
            analyticsKey: '',
            containerId: ''
        },
        environment: 'development'
    },

    /**
    *  Datadog RUM
    */
    {
        locTypeId: AlLocation.DatadogRum,
        uri: 'https://app.datadoghq.com/',
        data: {
            applicationId: '1ee41c9c-6e32-421d-87a1-c164238f2a65',
            clientToken: 'pub0e15fafbe120f94db5372fa66bb42300',
            site: 'datadoghq.com',
            service:'magma-integration'
        },
        environment: 'integration'
    },
    {
        locTypeId: AlLocation.DatadogRum,
        uri: 'https://app.datadoghq.com/',
        data: {
            applicationId: '',
            clientToken: '',
            site: 'datadoghq.com',
            service:''
        },
        environment: 'production|production-staging'
    },
    {
        locTypeId: AlLocation.DatadogRum,
        uri: 'https://app.datadoghq.com/',
        data: {
            applicationId: '',
            clientToken: '',
            site: 'datadoghq.com',
            service:''
        },
        environment: 'development'
    },

    /**
    *  Auth0 Configuration
    */
    {
        locTypeId: AlLocation.Auth0,
        uri: 'alertlogic.auth0.com',
        data: {
          clientID: 'k06YQlnk518d27rHf4FLM1SIu3Q4blgB'
        },
        environment: 'production|production-staging',
        residency: 'US'
    },
    {
        locTypeId: AlLocation.Auth0,
        uri: 'alertlogic-integration.auth0.com',
        data: {
          clientID: '6T6zEBgX0WMqksT8mC20c1OvvGqH7Jbj'
        },
        environment: 'integration'
    },
    {
        locTypeId: AlLocation.Auth0,
        uri: 'alertlogic-integration.auth0.com',
        data: {
          clientID: '6T6zEBgX0WMqksT8mC20c1OvvGqH7Jbj'
            /* clientID: '8eMblSx2Ead6nT7SeXffXbHT1I4JyAI4' */
        },
        environment: 'development'
    },

    /**
     * The elusively defined MDR APIs...
     */
    {
        locTypeId: AlLocation.MDRAPI,
        uri: 'https://{service}.mdr.global.alertlogic.com',
        environment: 'production|production-staging'
    },
    {
        locTypeId: AlLocation.MDRAPI,
        uri: 'https://{service}.mdr.product.dev.alertlogic.com',
        environment: 'integration|development|embedded-development|embedded-integration'
    },

    /**
     * Analytic Engine Configuration
     */
    {
        locTypeId: AlLocation.AETunerAPI,
        uri: 'https://aetuner.mdr.global.alertlogic.com',
        environment: 'production|production-staging',
    },
    {
        locTypeId: AlLocation.AETunerAPI,
        uri: 'https://aetuner.mdr.product.dev.alertlogic.com',
        environment: 'development|integration',
    },

    /**
     * Integrations  API locations
     */
    {
        locTypeId: AlLocation.IntegrationsAPI,
        uri: 'https://connectors.mdr.global.alertlogic.com',
        environment: 'production|production-staging'
    },
    {
        locTypeId: AlLocation.IntegrationsAPI,
        uri: 'https://connectors.mdr.product.dev.alertlogic.com',
        environment: 'integration|development|embedded-development|embedded-integration'
    },

    /**
     * Responder  API locations
     */
    {
        locTypeId: AlLocation.ResponderAPI,
        uri: 'https://responder.mdr.global.alertlogic.com',
        environment: 'production|production-staging'
    },
    {
        locTypeId: AlLocation.ResponderAPI,
        uri: 'https://responder.mdr.product.dev.alertlogic.com',
        environment: 'integration|development|embedded-development|embedded-integration'
    },
    {
        locTypeId: AlLocation.ResponderWS,
        uri: 'wss://responder-async.mdr.global.alertlogic.com',
        environment: 'production|production-staging'
    },
    {
        locTypeId: AlLocation.ResponderWS,
        uri: 'wss://responder-async.mdr.product.dev.alertlogic.com',
        environment: 'integration|development|embedded-development|embedded-integration'
    },

    /**
     * Distributor  API locations
     */
    {
        locTypeId: AlLocation.DistributorAPI,
        uri: 'https://distributor.mdr.global.alertlogic.com',
        environment: 'production|production-staging'
    },

    /**
     * Distributor  API locations
     */
    {
        locTypeId: AlLocation.DistributorAPI,
        uri: 'https://distributor.mdr.product.dev.alertlogic.com',
        environment: 'integration|development|embedded-development|embedded-integration'
    },

    /**
     * YARD locations
     */
    {
        locTypeId: AlLocation.YARDAPI,
        insightLocationId: 'defender-us-denver',
        uri: 'https://yard.alertlogic.com',
        environment: 'production|production-staging',
        residency: "US",
        external: true
    },
    {
        locTypeId: AlLocation.YARDAPI,
        insightLocationId: 'defender-us-ashburn',
        uri: 'https://yard.alertlogic.net',
        environment: 'production|production-staging',
        residency: "US",
        external: true
    },
    {
        locTypeId: AlLocation.YARDAPI,
        insightLocationId: 'defender-uk-newport',
        uri: 'https://yard.alertlogic.co.uk',
        environment: 'production|production-staging',
        residency: "EMEA",
        external: true
    },
    {
        locTypeId: AlLocation.YARDAPI,
        uri: 'https://yard.dsaops.alertlogic.net',
        environment: 'integration|development|embedded-development|embedded-integration',
        residency: "US",
        external: true
    },

    /**
     * Fortra Platform Base URL
     */
    {
        locTypeId: AlLocation.FortraPlatform,
        uri: 'https://foundation.foundation-dev.cloudops.fortradev.com',
        environment: 'embedded-development',
        external: true
    },
    {
        locTypeId: AlLocation.FortraPlatform,
        uri: 'https://foundation.foundation-stage.cloudops.fortradev.com',
        environment: 'development|integration|embedded-integration',
        external: true
    },
    {
        locTypeId: AlLocation.FortraPlatform,
        uri: 'https://platform.fortra.com',
        environment: 'production-staging|production',
        external: true
    },

    /**
     * Frontline VM
     */
    {
        locTypeId: AlLocation.FrontlineVM,
        uri: 'https://vm.flstaging.cloud',
        environment: 'integration|development|embedded-integration|embedded-development',
    },
    {
        locTypeId: AlLocation.FrontlineVM,
        uri: 'https://vm.us.frontline.cloud',
        environment: 'production-staging|production',
        residency: 'US'
    },
    {
        locTypeId: AlLocation.FrontlineVM,
        uri: 'https://vm.uk.frontline.cloud',
        environment: 'production-staging|production',
        residency: 'EMEA'
    }
];

