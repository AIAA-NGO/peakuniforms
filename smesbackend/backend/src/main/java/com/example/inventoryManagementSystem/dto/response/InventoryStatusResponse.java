
package com.example.inventoryManagementSystem.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class InventoryStatusResponse {
    private Long id;
    private String name;
    private String sku;
    private String barcode;
    private Integer quantityInStock;
    private Integer lowStockThreshold;
    private BigDecimal price;
    private BigDecimal costPrice;
    private String brandName;
    private String categoryName;
    private String unitName;
    private String stockStatus;
    private LocalDate expiryDate;
    private Boolean isExpired;

}