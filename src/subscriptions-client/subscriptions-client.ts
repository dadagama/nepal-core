import {
    AlApiClient,
    AlDefaultClient,
} from "../client";
import { AlLocation } from "../navigation";
import { AlEntitlementCollection } from './types';

export class AlSubscriptionsClient {

  private alClient;
  private internalUser:boolean = false;
  private serviceVersion:string = "v1";

  constructor( client:AlApiClient = null ) {
      this.alClient = client || AlDefaultClient;
  }

  /**
   * GET all Entitlements for an account
   * /subscriptions/v1/:account_id/entitlements
   * "https://api.global-integration.product.dev.alertlogic.com/subscriptions/v1/01000001/entitlements"
   */
  async getEntitlements( accountId:string, queryParams? ):Promise<AlEntitlementCollection> {
    const rawEntitlementData = await this.getRawEntitlements( accountId, queryParams );
    return AlEntitlementCollection.import( rawEntitlementData, this.internalUser );
  }

  /**
   * Get Entitlements
   * GET
   * /subscriptions/v1/:account_id/entitlements
   * "https://api.global-integration.product.dev.alertlogic.com/subscriptions/v1/01000001/entitlements"
   */
  async getRawEntitlements(accountId, queryParams?) {
    const entitlements = await this.alClient.get({
      service_stack: AlLocation.GlobalAPI,
      service_name: 'subscriptions',
      version: this.serviceVersion,
      account_id: accountId,
      path: '/entitlements',
      params: queryParams,
      ttl: 5 * 60 * 1000    /* 5 minute in-memory caching */
    });
    return entitlements;
  }

  /**
   * Get Entitlement

  /**
   * List Account Ids with a provided entitlement
   * GET
   * /subscriptions/v1/account_ids/entitlement/:product_family
   * "https://api.global-integration.product.dev.alertlogic.com/subscriptions/v1/account_ids/entitlement/log_manager"
   */
  async getAccountsByEntitlement(accountId, productFamily) {
    const accounts = await this.alClient.get({
      service_stack: AlLocation.GlobalAPI,
      service_name: 'subscriptions',
      version: this.serviceVersion,
      account_id: accountId,
      path: `/entitlements/${productFamily}`
    });
    return accounts;
  }

  /**
   * Create AWS subscriptions for the provided customer.
   * POST
   * /subscriptions/v1/:account_id/subscription/aws
   * https://api.global-integration.product.dev.alertlogic.com/subscriptions/v1/01000001/subscription/aws
   * -d '{"product_code":"ebbgj0o0g5cwo4**********",
   *      "aws_customer_identifier":"7vBT7cnzEYf",
   *      "status":"subscribe-success"}'
   */
  async createAWSSubscription(accountId, subscription) {
    const added = await this.alClient.post({
      service_name: 'subscriptions',
      version: this.serviceVersion,
      account_id: accountId,
      path: '/subscription/aws',
      data: subscription,
    });
    return added;
  }

  /**
   * Create full subscriptions
   * POST
   * /subscriptions/v1/:account_id/subscription
   * "https://api.global-integration.product.dev.alertlogic.com/subscriptions/v1/:account_id/subscription"
   * -d '{"active": true,
   *      "type": "manual",
   *      "entitlements":[
   *        {"product_family":"log_manager",
   *          "status": 'active|canceled|pending_activation',
   *          "end_date": Timestamp,
   *          "value_type": 'months', // Only allowed when product_family is ids_data_retention or log_data_retention
   *          "value": #Months, // Only allowed when product_family is ids_data_retention or log_data_retention}]
   *      }'
   */
  async createFullSubscription(accountId, entitlements) {
    const subscription = {
      entitlements,
      active: true,
      type: 'manual',
    };
    const added = await this.alClient.post({
      service_name: 'subscriptions',
      version: this.serviceVersion,
      account_id: accountId,
      path: '/subscription',
      data: subscription,
    });
    return added;
  }

  /**
   * Create standard subscriptions for the provided customer.
   * POST
   * /subscriptions/v1/:account_id/subscription/sync/standard
   * "https://api.global-integration.product.dev.alertlogic.com/subscriptions/v1/01000001/subscription/sync/standard"
   */
  async createStandardSubscription(accountId) {
    const added = await this.alClient.post({
      service_name: 'subscriptions',
      version: this.serviceVersion,
      account_id: accountId,
      path: '/subscription/sync/standard',
    });
    return added;
  }

  /**
   * Get subscription
   * GET
   * /subscriptions/v1/:account_id/subscription/:subscription_id
   * "https://api.global-integration.product.dev.alertlogic.com/subscriptions/v1/01000001/subscription/AAB2A94F-2A2F-474E-BEFD-C387E595F153"
   */
  async getSubscription(accountId, subscriptionId) {
    const subscription = await this.alClient.get({
      service_name: 'subscriptions',
      version: this.serviceVersion,
      account_id: accountId,
      path: `/subscription/${subscriptionId}`,
    });
    return subscription;
  }

  /**
   * Get subscriptions
   * GET
   * /subscriptions/v1/:account_id/subscriptions
   * "https://api.global-integration.product.dev.alertlogic.com/subscriptions/v1/01000001/subscriptions"
   */
  async getSubscriptions(accountId) {
    const subscriptions = await this.alClient.get({
      service_name: 'subscriptions',
      version: this.serviceVersion,
      account_id: accountId,
      path: '/subscriptions',
    });
    return subscriptions;
  }

  /**
   * Update AWS subscription
   * PUT
   * /subscriptions/v1/:account_id/subscription/aws
   * "https://api.global-integration.product.dev.alertlogic.com/subscriptions/v1/01000001/subscription/aws"
   * -d '{"product_code":"ebbgj0o0g5cwo4**********",
   *      "status":"unsubscribe-success"}'
   */
  async updateAWSSubscription(accountId, subscription) {
    const updated = await this.alClient.put({
      service_name: 'subscriptions',
      version: this.serviceVersion,
      account_id: accountId,
      path: '/subscription/aws',
      data: subscription,
    });
    return updated;
  }

  public setInternalUser( internal:boolean ) {
    this.internalUser = internal;
  }
}

/* tslint:disable:variable-name */
export const SubscriptionsClient = new AlSubscriptionsClient();
