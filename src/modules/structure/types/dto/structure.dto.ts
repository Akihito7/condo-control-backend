export class CreateEmployeeBody {
  name: string;
  salary: string;
  cpf: string;
  employeeRoleId: number;
  phoneNumber: string;
  status: number;
  workAreaId: string;
  condominiumId: string;
  email?: string;
  password?: string;
}

export class UpdateEmployeeScheduleBody {
  shift: string
  data: WorkInfo[]
}

type WorkInfo = {
  workAreaId: number,
  employeeIds: number[]
}

export type EventSpace = {
  id: number
  eventDate: string
  startTime: string
  endTime: string
  apartmentId: number
  condominiumAreaId: number
  createdAt: Date
  spaceEventsRelationAreaAvailability: any[]
}

export interface InterventionBody {
  priority: string;                 // obrigatório
  type: string;                    // obrigatório
  area: string;                    // obrigatório
  description: string;             // obrigatório
  provider?: string;               // opcional
  value: string;                   // obrigatório, com formato regex
  paymentMethod: string;           // obrigatório
  paymentDate?: Date | null;       // opcional, nullable
  paymentCompletionDate?: Date | null;
  duration?: string;               // opcional
  plannedStart?: Date | null;      // opcional, nullable
  plannedEnd?: Date | null;        // opcional, nullable
  actualStart?: Date | null;       // opcional, nullable
  actualEnd?: Date | null;         // opcional, nullable
  status: string;                  // obrigatório
  isInstallment: true,
  numberOfInstallments: number;
  contact?: string
  typeMaintenance?: string;
  assetType?: string;
}




export type InterventionPayment = {
  id: number;
  maintenanceId: number;
  paymentDate: string; // ISO data string
  amount: number;
  isInstallment: boolean;
  createdAt: string; // ISO data string
  updatedAt: string; // ISO data string

  // Campos relacionados à manutenção, com prefixo "maintenances"
  maintenancesId: number;
  maintenancesAmount: number;
  maintenancesTypeId: number;
  maintenancesSupplier: string;
  maintenancesStatusId: number;
  maintenancesActualEnd: string | null; // pode ser null
  maintenancesCreatedAt: string;
  maintenancesUpdatedAt: string;
  maintenancesDescription: string;
  maintenancesPlannedEnd: string;
  maintenancesPriorityId: number;
  maintenancesActualStart: string | null;
  maintenancesPaymentDate: string;
  maintenancesCreatedById: number;
  maintenancesPlannedStart: string;
  maintenancesCondominiumId: number;
  maintenancesExecutionTime: string;
  maintenancesIsInstallment: boolean;
  maintenancesPaymentMethod: number;
  maintenancesCondominiumAreaId: number;
  maintenancesNumberOfInstallments: number | null;
  maintenancesPaymentCompletionDate: string | null;
};

export type BodyAsset = {

  code: string
  item: string
  areaId: string
  statusId: string
  categoryId: string

}

export type CreateMaintenanceManagementAssetDTO = {
  code: string;
  frequency: string;
  installationDate: Date;
  lifespan: number;
  name: string;
  supplier: string;
  type: string;
  contact: string;
}
