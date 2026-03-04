-- CreateTable
CREATE TABLE "element_floor_mapping" (
    "building_id" TEXT NOT NULL,
    "db_id" INTEGER NOT NULL,
    "floor_id" TEXT NOT NULL,
    "bounding_box_min_z" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "element_floor_mapping_pkey" PRIMARY KEY ("building_id","db_id")
);

-- AddForeignKey
ALTER TABLE "element_floor_mapping" ADD CONSTRAINT "element_floor_mapping_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "building"("building_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "element_floor_mapping" ADD CONSTRAINT "element_floor_mapping_floor_id_fkey" FOREIGN KEY ("floor_id") REFERENCES "floor"("floor_id") ON DELETE CASCADE ON UPDATE CASCADE;
