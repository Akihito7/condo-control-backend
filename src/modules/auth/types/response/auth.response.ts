export type User = {
  id: number;
  name: string;
  isSuper: boolean;
  email: string;
  phone: string;
  password: string;
  createdAt: string;
  updatedAt: string | null;
  cpf: string;

  userAssociationId: number;
  userAssociationRole: string;
  userAssociationUserId: number;
  userAssociationCreatedAt: string;
  userAssociationUpdatedAt: string | null;
  userAssociationApartmentId: number | null;
  userAssociationCondominiumId: number;

  condominiumId: number;
};
