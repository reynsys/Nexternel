-- V4 product boundary: system label updates and garden deprecation tier.

UPDATE systems SET label = 'Lights', tier = 'core' WHERE id = 'lighting';
UPDATE systems SET label = 'Network', tier = 'extended' WHERE id = 'network';
UPDATE systems SET label = 'Vehicles', tier = 'extended' WHERE id = 'vehicles';
UPDATE systems SET label = 'Garden', tier = 'deprecated' WHERE id = 'garden';
