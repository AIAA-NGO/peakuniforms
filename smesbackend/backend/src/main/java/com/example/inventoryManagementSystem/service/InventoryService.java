package com.example.inventoryManagementSystem.service;

import com.example.inventoryManagementSystem.dto.request.InventoryAdjustmentRequest;
import com.example.inventoryManagementSystem.dto.response.InventoryStatusResponse;
import com.example.inventoryManagementSystem.dto.response.LowStockSuggestionResponse;
import com.example.inventoryManagementSystem.dto.response.ProductResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface InventoryService {
    Page<ProductResponse> getAllProducts(Pageable pageable);

    Page<InventoryStatusResponse> getInventoryStatus(
            String search, Long categoryId, Long brandId,
            Boolean lowStockOnly, Boolean expiredOnly,
            Pageable pageable);

    void adjustInventory(InventoryAdjustmentRequest request);

    void removeExpiredProducts();

    List<LowStockSuggestionResponse> getLowStockSuggestions();
}