-- Global Performance & Speed Audit System
-- Makes application light, fast, and production-grade

-- Performance monitoring table
CREATE TABLE IF NOT EXISTS performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  response_time_ms INTEGER NOT NULL,
  status_code INTEGER NOT NULL,
  user_id UUID,
  user_role VARCHAR(20),
  query_count INTEGER DEFAULT 0,
  bundle_size_kb INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Slow queries tracking
CREATE TABLE IF NOT EXISTS slow_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_text TEXT NOT NULL,
  execution_time_ms INTEGER NOT NULL,
  calls INTEGER DEFAULT 1,
  avg_time_ms DECIMAL(10,2),
  route VARCHAR(255),
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bundle size tracking
CREATE TABLE IF NOT EXISTS bundle_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page VARCHAR(255) NOT NULL,
  bundle_size_kb INTEGER NOT NULL,
  js_size_kb INTEGER NOT NULL,
  css_size_kb INTEGER NOT NULL,
  component_count INTEGER DEFAULT 0,
  load_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_performance_metrics_route ON performance_metrics(route, created_at);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_response_time ON performance_metrics(response_time_ms);
CREATE INDEX IF NOT EXISTS idx_slow_queries_execution_time ON slow_queries(execution_time_ms);
CREATE INDEX IF NOT EXISTS idx_slow_queries_calls ON slow_queries(calls);
CREATE INDEX IF NOT EXISTS idx_bundle_metrics_page ON bundle_metrics(page);

-- Function to log API performance
CREATE OR REPLACE FUNCTION log_api_performance(
  p_route VARCHAR(255),
  p_method VARCHAR(10),
  p_response_time_ms INTEGER,
  p_status_code INTEGER,
  p_query_count INTEGER DEFAULT 0
)
RETURNS void AS $$
BEGIN
  INSERT INTO performance_metrics (
    route,
    method,
    response_time_ms,
    status_code,
    user_id,
    user_role,
    query_count,
    created_at
  ) VALUES (
    p_route,
    p_method,
    p_response_time_ms,
    p_status_code,
    (auth.jwt()->>'sub')::UUID,
    auth.jwt()->>'role',
    p_query_count,
    NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get slowest queries
CREATE OR REPLACE FUNCTION get_slowest_queries(limit_count INTEGER DEFAULT 5)
RETURNS TABLE(
  query_text TEXT,
  execution_time_ms INTEGER,
  calls INTEGER,
  avg_time_ms DECIMAL(10,2),
  route VARCHAR(255)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sq.query_text,
    sq.execution_time_ms,
    sq.calls,
    sq.avg_time_ms,
    sq.route
  FROM slow_queries sq
  ORDER BY sq.execution_time_ms DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get heaviest components
CREATE OR REPLACE FUNCTION get_heaviest_components(limit_count INTEGER DEFAULT 5)
RETURNS TABLE(
  page VARCHAR(255),
  bundle_size_kb INTEGER,
  js_size_kb INTEGER,
  css_size_kb INTEGER,
  component_count INTEGER,
  load_time_ms INTEGER,
  size_score DECIMAL(10,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bm.page,
    bm.bundle_size_kb,
    bm.js_size_kb,
    bm.css_size_kb,
    bm.component_count,
    bm.load_time_ms,
    (bm.bundle_size_kb * 0.7 + bm.load_time_ms * 0.3) as size_score
  FROM bundle_metrics bm
  ORDER BY size_score DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get performance summary
CREATE OR REPLACE FUNCTION get_performance_summary()
RETURNS TABLE(
  metric_name VARCHAR(100),
  current_value DECIMAL,
  target_value DECIMAL,
  status VARCHAR(20),
  recommendation TEXT
) AS $$
DECLARE
  avg_response_time DECIMAL;
  slow_query_count BIGINT;
  avg_bundle_size DECIMAL;
  api_calls_today BIGINT;
BEGIN
  -- Calculate metrics
  SELECT AVG(response_time_ms) INTO avg_response_time
  FROM performance_metrics 
  WHERE created_at >= CURRENT_DATE;
  
  SELECT COUNT(*) INTO slow_query_count
  FROM slow_queries 
  WHERE created_at >= CURRENT_DATE 
    AND execution_time_ms > 200;
  
  SELECT AVG(bundle_size_kb) INTO avg_bundle_size
  FROM bundle_metrics 
  WHERE created_at >= CURRENT_DATE;
  
  SELECT COUNT(*) INTO api_calls_today
  FROM performance_metrics 
  WHERE created_at >= CURRENT_DATE;
  
  -- Return performance summary
  RETURN QUERY
  SELECT 
    'Average Response Time' as metric_name,
    avg_response_time as current_value,
    300 as target_value,
    CASE 
      WHEN avg_response_time <= 200 THEN 'GOOD'
      WHEN avg_response_time <= 500 THEN 'OK'
      ELSE 'POOR'
    END as status,
    CASE 
      WHEN avg_response_time > 500 THEN 'Optimize database queries and add caching'
      WHEN avg_response_time > 300 THEN 'Review slow endpoints and add indexes'
      ELSE 'Performance is optimal'
    END as recommendation
  
  UNION ALL
  
  SELECT 
    'Slow Queries (>200ms)' as metric_name,
    slow_query_count::DECIMAL as current_value,
    0 as target_value,
    CASE 
      WHEN slow_query_count = 0 THEN 'GOOD'
      WHEN slow_query_count <= 5 THEN 'OK'
      ELSE 'POOR'
    END as status,
    CASE 
      WHEN slow_query_count > 10 THEN 'Review query performance and add indexes'
      WHEN slow_query_count > 5 THEN 'Monitor query patterns'
      ELSE 'Query performance is optimal'
    END as recommendation
  
  UNION ALL
  
  SELECT 
    'Average Bundle Size' as metric_name,
    avg_bundle_size as current_value,
    120 as target_value,
    CASE 
      WHEN avg_bundle_size <= 120 THEN 'GOOD'
      WHEN avg_bundle_size <= 200 THEN 'OK'
      ELSE 'POOR'
    END as status,
    CASE 
      WHEN avg_bundle_size > 200 THEN 'Implement code splitting and lazy loading'
      WHEN avg_bundle_size > 120 THEN 'Optimize imports and remove unused dependencies'
      ELSE 'Bundle size is optimal'
    END as recommendation
  
  UNION ALL
  
  SELECT 
    'API Calls Today' as metric_name,
    api_calls_today::DECIMAL as current_value,
    0 as target_value,
    CASE 
      WHEN api_calls_today <= 1000 THEN 'GOOD'
      WHEN api_calls_today <= 5000 THEN 'OK'
      ELSE 'HIGH'
    END as status,
    CASE 
      WHEN api_calls_today > 10000 THEN 'Consider rate limiting and caching'
      WHEN api_calls_today > 5000 THEN 'Monitor for potential abuse'
      ELSE 'API usage is normal'
    END as recommendation;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old performance data
CREATE OR REPLACE FUNCTION cleanup_performance_data()
RETURNS void AS $$
BEGIN
  -- Delete performance metrics older than 30 days
  DELETE FROM performance_metrics 
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  -- Delete slow queries older than 7 days
  DELETE FROM slow_queries 
  WHERE created_at < NOW() - INTERVAL '7 days';
  
  -- Delete bundle metrics older than 14 days
  DELETE FROM bundle_metrics 
  WHERE created_at < NOW() - INTERVAL '14 days';
  
  -- Log cleanup
  INSERT INTO audit_log (action, details, created_at)
  VALUES (
    'performance_cleanup',
    json_build_object(
      'cleanup_time', NOW(),
      'metrics_deleted', (SELECT COUNT(*) FROM performance_metrics WHERE created_at < NOW() - INTERVAL '30 days'),
      'queries_deleted', (SELECT COUNT(*) FROM slow_queries WHERE created_at < NOW() - INTERVAL '7 days'),
      'bundles_deleted', (SELECT COUNT(*) FROM bundle_metrics WHERE created_at < NOW() - INTERVAL '14 days')
    ),
    NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule cleanup (daily at 2 AM)
SELECT cron.schedule(
  'performance-cleanup',
  '0 2 * * *',
  'SELECT cleanup_performance_data();'
);

-- Function to analyze query performance
CREATE OR REPLACE FUNCTION analyze_query_performance()
RETURNS TABLE(
  query_signature TEXT,
  total_executions BIGINT,
  total_time DECIMAL,
  avg_time DECIMAL,
  calls_per_min DECIMAL,
  performance_grade VARCHAR(10)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    SUBSTRING(query, 1, 100) as query_signature,
    calls as total_executions,
    total_executions * total_time as total_time,
    mean_time as avg_time,
    calls / EXTRACT(EPOCH FROM (NOW() - MIN(pg_stat_statements.min_time))) / 60 as calls_per_min,
    CASE 
      WHEN mean_time <= 50 THEN 'A'
      WHEN mean_time <= 100 THEN 'B'
      WHEN mean_time <= 200 THEN 'C'
      WHEN mean_time <= 500 THEN 'D'
      ELSE 'F'
    END as performance_grade
  FROM pg_stat_statements
  WHERE calls > 10
  ORDER BY mean_time DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- View for performance dashboard
CREATE OR REPLACE VIEW performance_dashboard AS
SELECT 
  'API Performance' as category,
  json_build_object(
    'avg_response_time', (SELECT AVG(response_time_ms) FROM performance_metrics WHERE created_at >= CURRENT_DATE),
    'total_requests', (SELECT COUNT(*) FROM performance_metrics WHERE created_at >= CURRENT_DATE),
    'error_rate', (SELECT COUNT(*)::DECIMAL / NULLIF((SELECT COUNT(*) FROM performance_metrics WHERE created_at >= CURRENT_DATE), 0) * 100 FROM performance_metrics WHERE created_at >= CURRENT_DATE AND status_code >= 400),
    'slow_requests', (SELECT COUNT(*) FROM performance_metrics WHERE created_at >= CURRENT_DATE AND response_time_ms > 500)
  ) as metrics
  
UNION ALL

SELECT 
  'Database Performance' as category,
  json_build_object(
    'slow_queries', (SELECT COUNT(*) FROM slow_queries WHERE created_at >= CURRENT_DATE),
    'avg_query_time', (SELECT AVG(avg_time_ms) FROM slow_queries WHERE created_at >= CURRENT_DATE),
    'total_queries', (SELECT SUM(calls) FROM slow_queries WHERE created_at >= CURRENT_DATE)
  ) as metrics
  
UNION ALL

SELECT 
  'Bundle Performance' as category,
  json_build_object(
    'avg_bundle_size', (SELECT AVG(bundle_size_kb) FROM bundle_metrics WHERE created_at >= CURRENT_DATE),
    'largest_bundle', (SELECT MAX(bundle_size_kb) FROM bundle_metrics WHERE created_at >= CURRENT_DATE),
    'total_bundles', (SELECT COUNT(*) FROM bundle_metrics WHERE created_at >= CURRENT_DATE)
  ) as metrics;

-- Grant permissions
GRANT SELECT ON performance_dashboard TO authenticated;
GRANT EXECUTE ON FUNCTION log_api_performance TO authenticated;
GRANT EXECUTE ON FUNCTION get_slowest_queries TO authenticated;
GRANT EXECUTE ON FUNCTION get_heaviest_components TO authenticated;
GRANT EXECUTE ON FUNCTION get_performance_summary TO authenticated;
GRANT EXECUTE ON FUNCTION analyze_query_performance TO authenticated;

-- RLS for performance tables
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE slow_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundle_metrics ENABLE ROW LEVEL SECURITY;

-- Only admins can view detailed performance data
CREATE POLICY "Admins can view performance metrics" ON performance_metrics
  FOR SELECT USING (auth.jwt()->>'role' = 'admin');

CREATE POLICY "Admins can view slow queries" ON slow_queries
  FOR SELECT USING (auth.jwt()->>'role' = 'admin');

CREATE POLICY "Admins can view bundle metrics" ON bundle_metrics
  FOR SELECT USING (auth.jwt()->>'role' = 'admin');

-- Log performance system implementation
INSERT INTO audit_log (action, details, created_at)
VALUES (
  'performance_system_implementation',
  json_build_object(
    'action', 'Global performance and speed audit system implemented',
    'features', ARRAY[
      'api_performance_tracking',
      'slow_query_monitoring',
      'bundle_size_analysis',
      'automated_cleanup',
      'performance_dashboard'
    ],
    'tables_created', 3,
    'views_created', 1,
    'scheduled_tasks', 1,
    'timestamp', NOW()
  ),
  NOW()
);
