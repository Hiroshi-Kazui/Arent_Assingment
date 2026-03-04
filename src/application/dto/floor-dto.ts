/**
 * Floor リスト表示用DTO
 */
export interface FloorListItemDto {
  floorId: string;
  name: string;
  floorNumber: number;
  elevation: number | null;
  issueCount: number;
}
