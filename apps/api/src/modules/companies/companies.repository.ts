import { CompanyModel, type CompanyDocument } from './companies.model.js';

export interface CompanyCreateInput {
  name: string;
  legalName?: string;
  taxId?: string;
  status?: 'active' | 'inactive';
}

export const companiesRepository = {
  async findById(id: string): Promise<CompanyDocument | null> {
    return CompanyModel.findById(id).exec();
  },

  async findByName(name: string): Promise<CompanyDocument | null> {
    return CompanyModel.findOne({ name }).exec();
  },

  async create(input: CompanyCreateInput): Promise<CompanyDocument> {
    return CompanyModel.create(input);
  },
};
