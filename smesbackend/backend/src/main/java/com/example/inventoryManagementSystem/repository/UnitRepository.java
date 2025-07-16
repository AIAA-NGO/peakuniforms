package com.example.inventoryManagementSystem.repository;

import com.example.inventoryManagementSystem.model.Unit;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface UnitRepository extends JpaRepository<Unit, Long> {
    List<Unit> findByNameContainingIgnoreCaseOrAbbreviationContainingIgnoreCase(String name, String abbreviation);
}