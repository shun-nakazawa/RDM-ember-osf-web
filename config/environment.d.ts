/**
 * Type declarations for
 *    import config from './config/environment'
 *
 * For now these need to be managed by the developer
 * since different ember addons can materialize new entries.
 */

export interface KeenConfig {
    public?: {
        projectId: string;
        writeKey: string;
    };
    private?: {
        projectId: string;
        writeKey: string;
    };
}

declare const config: {
    organization: string;
    environment: any;
    lintOnBuild: boolean;
    testsEnabled: boolean;
    sourcemapsEnabled: boolean;
    showDevBanner: boolean;
    modulePrefix: string;
    locationType: string;
    rootURL: string;
    assetsPrefix: string;
    sentryDSN: string | null;
    sentryOptions: {
        release?: string;
        ignoreErrors: string[];
    };
    EmberENV: {
        FEATURES: {};
        EXTEND_PROTOTYPES: {
            Date: boolean;
        };
    };
    APP: {};
    moment: {
        includeTimezone: string;
        outputFormat: string;
    };
    metricsAdapters: Array<{
        name: string;
        environments: string[];
        config: any;
        dimensions?: {
            authenticated: string;
            resource: string;
            isPublic: string;
            isWithdrawn: string;
            version: string;
        };
    }>;
    FB_APP_ID?: string;
    OSF: {
        pageName: string;
        longBrand: string;
        clientId?: string;
        scope?: string;
        apiNamespace: string;
        backend: string;
        redirectUri?: string;
        url: string;
        webApiNamespace: string;
        apiUrl: string;
        apiVersion: string;
        apiHeaders: { [k: string]: string };
        learnMoreUrl: string;
        renderUrl: string;
        waterbutlerUrl: string;
        helpUrl: string;
        shareBaseUrl: string;
        shareApiUrl: string;
        shareSearchUrl: string;
        devMode: boolean;
        cookieDomain: string;
        authenticator: string;
        cookies: {
            status: string;
            keenUserId: string;
            keenSessionId: string;
            analyticsDismissAdblock: string;
            cookieConsent: string;
            maintenance: string;
            csrf: string;
            authSession: string;
        };
        localStorageKeys: {
            authSession: string;
            joinBannerDismissed: string;
        };
        casUrl: string;
        analyticsAttrs: {
            name: string;
            scope: string;
            category: string;
            extra: string;
            action: string;
        };
        doiUrlPrefix: string;
        simplePage: boolean;
        projectAffiliate: boolean;
    };
    social: {
        twitter: {
            viaHandle: string;
        };
    };
    signUpPolicy: {
        termsLink: string;
        privacyPolicyLink: string;
        cookiesLink: string;
    };
    footerLinks: {
        cos: string,
        statusPage: string,
        apiDocs: string,
        topGuidelines: string,
        rpp: string,
        rpcb: string,
        twitter: string,
        facebook: string,
        googleGroup: string,
        github: string,
    },
    support: {
        globalUrl: string;
        preregUrl: string;
        statusPageUrl: string;
        faqPageUrl: string;
        supportEmail: string;
        contactEmail: string;
        consultationUrl: string;
        twitterUrl: string;
        mailingUrl: string;
        facebookUrl: string;
        githubUrl: string;
    };
    helpLinks: {
        linkToAProject: string;
    };
    dashboard: {
        popularNode: string;
        noteworthyNode: string;
    };
    featureFlagNames: {
        routes: {
            [routeName: string]: string;
        };
        navigation: {
            institutions: string;
        };
        ABTesting: {
            homePageHeroTextVersionB: string;
        };
        storageI18n: string;
        enableInactiveSchemas: string;
        verifyEmailModals: string;
        egapAdmins: string;
    };
    gReCaptcha: {
        siteKey: string;
    };
    home: {
        youtubeId: string;
    };
    navbar: {
        useDropdown: boolean;
        useQuickfiles: boolean;
        useRegistrations: boolean;
        useSearch: boolean;
        useSupport: boolean;
        useGlobalSupport: boolean;
        useDonate: boolean;
        useSignup: boolean;
        useEmbeddedDS: boolean;
    },
    secondaryNavbarId: string;
    dsconfig: {
        settingFile: string;
        wayfScript: string;
    };
    'ember-a11y-testing'?: {
        componentOptions: {
            turnAuditOff: boolean,
        },
    };
    'ember-cli-mirage': {
        enabled: boolean;
    };
    'changeset-validations': {
        rawOutput?: boolean,
    };

    mirageScenarios: string[];

    engines: {
        collections: {
            enabled: boolean;
        };
        registries: {
            enabled: boolean;
        };
    };
    'ember-cli-tailwind'?: {
        shouldIncludeStyleguide: boolean,
    };

    defaultProvider: string;

    pageTitle: {
        prepend: boolean;
    };
};

export default config;
