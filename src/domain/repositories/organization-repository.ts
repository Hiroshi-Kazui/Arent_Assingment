import { Organization, OrganizationId } from '../models/organization';

export interface IOrganizationRepository {
  findById(id: OrganizationId): Promise<Organization | null>;
  findAll(): Promise<Organization[]>;
  save(organization: Organization): Promise<void>;
  delete(id: OrganizationId): Promise<void>;
}
