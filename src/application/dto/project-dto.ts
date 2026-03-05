/**
 * Project リスト表示用DTO
 */
export interface ProjectListItemDto {
  projectId: string;
  name: string;
  plan: string;
  buildingId: string;
  branchId: string;
  status: string;
  issueCount: number;
  progressRate: number;
  startDate: Date;
  dueDate: Date;
}

/**
 * Project 詳細DTO
 */
export interface ProjectDetailDto {
  projectId: string;
  name: string;
  buildingId: string;
  branchId: string | null;
  branchName: string | null;
  status: string;
  startDate: Date;
  dueDate: Date;
  building: {
    buildingId: string;
    name: string;
    address: string;
    modelUrn: string;
  };
}
