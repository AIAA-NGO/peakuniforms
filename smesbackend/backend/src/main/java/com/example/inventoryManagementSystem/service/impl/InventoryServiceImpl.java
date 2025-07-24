package com.example.inventoryManagementSystem.service.impl;

import com.example.inventoryManagementSystem.dto.request.InventoryAdjustmentRequest;
import com.example.inventoryManagementSystem.dto.response.InventoryStatusResponse;
import com.example.inventoryManagementSystem.dto.response.LowStockSuggestionResponse;
import com.example.inventoryManagementSystem.dto.response.ProductResponse;
import com.example.inventoryManagementSystem.exception.ResourceNotFoundException;
import com.example.inventoryManagementSystem.model.*;
import com.example.inventoryManagementSystem.repository.*;
import com.example.inventoryManagementSystem.service.InventoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.lang.reflect.InvocationTargetException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class InventoryServiceImpl implements InventoryService {

    private final ProductRepository productRepository;
    private final InventoryAdjustmentRepository inventoryAdjustmentRepository;
    private final PurchaseRepository purchaseRepository;
    private final PurchaseItemRepository purchaseItemRepository;
    private final SupplierRepository supplierRepository;

    @Override
    public Page<ProductResponse> getAllProducts(Pageable pageable) {
        return productRepository.findAll(pageable)
                .map(this::convertToProductResponse);
    }

    @Override
    public Page<InventoryStatusResponse> getInventoryStatus(
            String search, Long categoryId, Long brandId,
            Boolean lowStockOnly, Boolean expiredOnly, Pageable pageable) {

        return productRepository.findAll(pageable)
                .map(this::convertToInventoryStatusResponse);
    }

    @Override
    @Transactional
    public void adjustInventory(InventoryAdjustmentRequest request) {
        Product product = productRepository.findById(request.getProductId())
                .orElseThrow(() -> new ResourceNotFoundException("Product not found with id: " + request.getProductId()));

        if (request.getAdjustmentAmount() != null && request.getAdjustmentAmount() != 0) {
            adjustProductStock(product, request.getAdjustmentAmount(), request.getReason());
        }

        if (Boolean.TRUE.equals(request.getCreateSupplierOrder())) {
            createSupplierOrder(product, request.getOrderQuantity(), request.getReason());
        }
    }

    @Override
    @Transactional
    public void removeExpiredProducts() {
        List<Product> expiredProducts = productRepository.findByExpiryDateBefore(LocalDate.now());

        expiredProducts.forEach(product -> {
            InventoryAdjustment adjustment = new InventoryAdjustment();
            adjustment.setProduct(product);
            adjustment.setAdjustmentAmount(-product.getQuantityInStock());
            adjustment.setReason("Expired product removal");
            adjustment.setAdjustmentDate(LocalDate.now());
            inventoryAdjustmentRepository.save(adjustment);
            product.setQuantityInStock(0);
            productRepository.save(product);
        });
    }

    @Override
    public List<LowStockSuggestionResponse> getLowStockSuggestions() {
        List<Product> lowStockProducts = productRepository.findAll().stream()
                .filter(Product::isLowStock)
                .collect(Collectors.toList());

        return lowStockProducts.stream()
                .filter(product -> product.getSupplier() != null)
                .map(this::convertToLowStockSuggestion)
                .collect(Collectors.toList());
    }

    private ProductResponse convertToProductResponse(Product product) {
        return ProductResponse.builder()
                .id(product.getId())
                .name(product.getName())
                .description(product.getDescription())
                .sku(product.getSku())
                .barcode(product.getBarcode())
                .price(product.getPrice())
                .costPrice(product.getCostPrice())
                .quantityInStock(product.getQuantityInStock())
                .lowStockThreshold(product.getLowStockThreshold())
                .categoryId(product.getCategory() != null ? product.getCategory().getId() : null)
                .categoryName(product.getCategory() != null ? product.getCategory().getName() : null)
                .supplierId(product.getSupplier() != null ? product.getSupplier().getId() : null)
                .supplierName(product.getSupplier() != null ? product.getSupplier().getCompanyName() : null)
                .supplierContactPerson(product.getSupplier() != null ? product.getSupplier().getContactPerson() : null)
                .supplierEmail(product.getSupplier() != null ? product.getSupplier().getEmail() : null)
                .supplierPhone(product.getSupplier() != null ? product.getSupplier().getPhone() : null)
                .supplierAddress(product.getSupplier() != null ? product.getSupplier().getAddress() : null)
                .supplierWebsite(product.getSupplier() != null ? product.getSupplier().getWebsite() : null)
                .brandId(product.getBrand() != null ? product.getBrand().getId() : null)
                .brandName(product.getBrand() != null ? product.getBrand().getName() : null)
                .unitId(product.getUnit() != null ? product.getUnit().getId() : null)
                .unitName(product.getUnit() != null ? product.getUnit().getName() : null)
                .unitAbbreviation(product.getUnit() != null ? product.getUnit().getAbbreviation() : null)
                .expiryDate(product.getExpiryDate())
                .imageUrl(product.getImageUrl())
                .createdAt(product.getCreatedAt())
                .updatedAt(product.getUpdatedAt())
                .build();
    }

    private void adjustProductStock(Product product, int adjustmentAmount, String reason) {
        int newQuantity = product.getQuantityInStock() + adjustmentAmount;
        if (newQuantity < 0) {
            throw new IllegalArgumentException("Cannot adjust stock below zero");
        }
        product.setQuantityInStock(newQuantity);
        productRepository.save(product);
        InventoryAdjustment adjustment = new InventoryAdjustment();
        adjustment.setProduct(product);
        adjustment.setAdjustmentAmount(adjustmentAmount);
        adjustment.setReason(reason);
        adjustment.setAdjustmentDate(LocalDate.now());
        inventoryAdjustmentRepository.save(adjustment);
    }

    private void createSupplierOrder(Product product, Integer orderQuantity, String reason) {
        if (product.getSupplier() == null) {
            throw new IllegalStateException("Product has no supplier assigned");
        }

        if (orderQuantity == null || orderQuantity <= 0) {
            throw new IllegalArgumentException("Order quantity must be positive");
        }

        Purchase purchase = new Purchase();
        purchase.setSupplier(product.getSupplier());
        purchase.setOrderDate(LocalDateTime.now());
        purchase.setStatus(Purchase.PurchaseStatus.PENDING);

        String noteOrReason = reason != null ? reason : "Low stock replenishment";
        try {
            purchase.getClass().getMethod("setNotes", String.class)
                    .invoke(purchase, noteOrReason);
        } catch (NoSuchMethodException e1) {
            try {
                purchase.getClass().getMethod("setReason", String.class)
                        .invoke(purchase, noteOrReason);
            } catch (NoSuchMethodException | IllegalAccessException | InvocationTargetException e2) {
                throw new IllegalStateException("Purchase entity has neither setNotes nor setReason method", e2);
            }
        } catch (IllegalAccessException | InvocationTargetException e) {
            throw new IllegalStateException("Failed to set notes/reason on Purchase", e);
        }

        purchase = purchaseRepository.save(purchase);
        PurchaseItem purchaseItem = new PurchaseItem();
        purchaseItem.setProduct(product);
        purchaseItem.setQuantity(orderQuantity);
        purchaseItem.setUnitPrice(BigDecimal.valueOf(product.getCostPrice()));
        purchaseItem.setPurchase(purchase);
        purchaseItemRepository.save(purchaseItem);
        purchase.setTotalAmount(BigDecimal.valueOf(product.getCostPrice() * orderQuantity));
        purchaseRepository.save(purchase);
    }

    private InventoryStatusResponse convertToInventoryStatusResponse(Product product) {
        boolean isExpired = product.getExpiryDate() != null &&
                product.getExpiryDate().isBefore(LocalDate.now());

        String stockStatus;
        if (isExpired) {
            stockStatus = "EXPIRED";
        } else if (product.isLowStock()) {
            stockStatus = "LOW";
        } else {
            stockStatus = "OK";
        }

        return InventoryStatusResponse.builder()
                .id(product.getId())
                .name(product.getName())
                .sku(product.getSku())
                .barcode(product.getBarcode())
                .quantityInStock(product.getQuantityInStock())
                .lowStockThreshold(product.getLowStockThreshold())
                .price(BigDecimal.valueOf(product.getPrice()))
                .costPrice(BigDecimal.valueOf(product.getCostPrice()))
                .brandName(product.getBrand() != null ? product.getBrand().getName() : null)
                .categoryName(product.getCategory() != null ? product.getCategory().getName() : null)
                .unitName(product.getUnit() != null ? product.getUnit().getName() : null)
                .stockStatus(stockStatus)
                .expiryDate(product.getExpiryDate())
                .isExpired(isExpired)
                .build();
    }

    private LowStockSuggestionResponse convertToLowStockSuggestion(Product product) {
        int suggestedQuantity = calculateSuggestedOrderQuantity(product);

        return LowStockSuggestionResponse.builder()
                .productId(product.getId())
                .productName(product.getName())
                .sku(product.getSku())
                .currentStock(product.getQuantityInStock())
                .lowStockThreshold(product.getLowStockThreshold())
                .suggestedOrderQuantity(suggestedQuantity)
                .supplierName(product.getSupplier().getCompanyName())
                .supplierId(product.getSupplier().getId())
                .costPrice(BigDecimal.valueOf(product.getCostPrice()))
                .estimatedTotal(BigDecimal.valueOf(product.getCostPrice() * suggestedQuantity))
                .build();
    }

    private int calculateSuggestedOrderQuantity(Product product) {
        int suggested = product.getLowStockThreshold() * 2 - product.getQuantityInStock();
        return Math.max(Math.max(suggested, product.getLowStockThreshold()), 10);
    }
}