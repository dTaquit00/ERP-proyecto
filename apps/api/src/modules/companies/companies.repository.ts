import { CompanyModel, type CompanyDocument } from './companies.model.js';

export interface CompanyCreateInput {
  name: string;
  legalName?: string;
  taxId?: string;
  phone?: string;
  email?: string;
  address?: string;
  status?: 'active' | 'inactive';
  settings?: Record<string, unknown>;
}

export interface CompanyFieldChanges {
  name?: string;
  legalName?: string;
  taxId?: string;
  phone?: string;
  email?: string;
  address?: string;
  status?: 'active' | 'inactive';
  settings?: Record<string, unknown>;
}

export const companiesRepository = {
  async findByIdScoped(companyId: string, id: string): Promise<CompanyDocument | null> {
    if (companyId !== id) return null;
    return CompanyModel.findById(id).exec();
  },

  async findByName(name: string): Promise<CompanyDocument | null> {
    return CompanyModel.findOne({ name }).exec();
  },

  async listById(companyId: string): Promise<CompanyDocument[]> {
    return CompanyModel.find({ _id: companyId }).sort({ name: 1 }).exec();
  },

  async create(input: CompanyCreateInput): Promise<CompanyDocument> {
    return CompanyModel.create(input);
  },

  async saveChanges(
    company: CompanyDocument,
    changes: CompanyFieldChanges,
  ): Promise<CompanyDocument> {
    Object.assign(company, changes);
    await company.save();
    return company;
  },
};
