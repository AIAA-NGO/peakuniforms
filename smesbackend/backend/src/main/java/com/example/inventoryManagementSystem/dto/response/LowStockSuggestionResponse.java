package com.example.inventoryManagementSystem.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;


@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class LowStockSuggestionResponse {
    private Long productId;
    private String productName;
    private String sku;
    private Integer currentStock;
    private Integer lowStockThreshold;
    private Integer suggestedOrderQuantity;
    private String supplierName;
    private Long supplierId;
    private BigDecimal costPrice;
    private BigDecimal estimatedTotal;
}