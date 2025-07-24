package com.example.inventoryManagementSystem.service;

import com.example.inventoryManagementSystem.dto.request.InventoryAdjustmentRequest;
import com.example.inventoryManagementSystem.dto.response.InventoryStatusResponse;
import com.example.inventoryManagementSystem.dto.response.LowStockSuggestionResponse;

import java.util.List;

public interface InventoryService {
    List<InventoryStatusResponse> getInventoryStatus(
            String search, Long categoryId, Long brandId,
            Boolean lowStockOnly, Boolean expiredOnly);

    void adjustInventory(InventoryAdjustmentRequest request);

    void removeExpiredProducts();

    List<LowStockSuggestionResponse> getLowStockSuggestions();
}