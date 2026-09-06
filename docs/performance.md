# DataLens Performance Specification

## 1. Performance Goals
DataLens aims to provide responsive analysis for datasets up to several million rows without compromising API stability.

## 2. Performance Targets (MVP)
| Dataset Size | Profiling Latency | Quality Analysis Latency | Target Memory Usage |
|---|---|---|---|
| 10k rows | < 2 seconds | < 5 seconds | < 500 MB |
| 100k rows | < 5 seconds | < 15 seconds | < 1 GB |
| 1M rows | < 30 seconds | < 60 seconds | < 4 GB |

## 3. Optimization Strategies

### 3.1 Python Engine Optimizations
- **Vectorization**: Use NumPy and Pandas vectorized operations instead of Python loops.
- **Memory Mapping**: For extremely large files, use `chunksize` in `read_csv` to process data in batches.
- **Dtype Optimization**: Convert `float64` to `float32` and `int64` to `int32` where precision allows to reduce memory footprint.
- **Parallelism**: Use `multiprocessing` for independent column analysis.

### 3.2 Backend & Infrastructure Optimizations
- **Asynchronous Jobs**: The API returns `202 Accepted` immediately. No HTTP connection is held open during analysis.
- **Redis Caching**: Job status is cached in Redis to avoid PostgreSQL overhead during polling.
- **Connection Pooling**: Use PostgreSQL connection pooling (e.g., `pg-pool`) to handle concurrent API requests efficiently.

## 4. Performance Testing Strategy
- **Benchmarking**: Run a suite of synthetic datasets with varying sizes (10k to 10M rows).
- **Profiling**: Use `memory_profiler` and `cProfile` in the Python engine to identify bottlenecks.
- **Load Testing**: Use tools like `k6` or `Locust` to simulate multiple concurrent users uploading files and triggering analysis.
- **Resource Limits**: Set Docker container limits (`cpus`, `memory`) to ensure the system remains stable under peak load.
