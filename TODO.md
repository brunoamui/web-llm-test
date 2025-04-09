# Web-LLM Test App: Statistics Implementation Plan

## Overview
We've implemented the basic statistics dashboard, but we need a more robust approach to extract complete statistics from the web-llm engine. The current implementation doesn't capture all available data, particularly during model loading and inference.

## Implementation Progress

### 1-6. Core Features ✅
- All core features have been implemented, including component creation and UI integration.

## Bug Fixes - Previous Sprints ✅
- [x] Fix missing Progress component from shadcn/ui library
- [x] Debug data flow from ChatInterface to main page
- [x] Add logging to track data collection
- [x] Fix model loading/download hanging issue
- [x] Handle Promise-based return from runtimeStatsText()

## Bug Fixes - Current Sprint
- [x] Implement unified logging system
  - [x] Create logger.ts with log levels (ERROR, WARN, INFO, DEBUG, TRACE)
  - [x] Replace recursive object exploration with smart JSON.stringify
  - [x] Implement component-specific logging with selectivity
  - [x] Update objectExplorer.ts to use the new logging system
  - [x] Add proper formatting for logged objects
  - [x] Update all components to use the new logging system

- [x] Enhance logging configuration implementation
  - [x] Server-side
    - [x] Add environment variable support for log level (LOG_LEVEL)
    - [x] Read from .env file and process.env
    - [x] Create server.ts logger initialization module
    - [x] Add component-specific log level configuration via env vars (LOG_LEVEL_COMPONENT=DEBUG)
  - [x] Client-side
    - [x] Add log level selector to model config form
    - [x] Store log level preference in local storage
    - [x] Create debug panel component for runtime log configuration
    - [x] Add ability to adjust component log levels individually
  - [x] Migration
    - [x] Replace all console.log calls with appropriate logger calls
    - [x] Add component loggers to each module
    - [x] Standardize log message formats
    - [x] Add log context enrichment where appropriate
  - [x] Documentation
    - [x] Document logging best practices
    - [x] Add logging section to README.md
    - [x] Create examples of proper logging usage

- [x] Implement enhanced engine stat extraction
  - [x] Phase 1: Engine Object Exploration
    - [x] Create debug utility to log all available engine properties
    - [x] Implement recursive object explorer to find nested statistics
    - [x] Document discovered properties for future reference
    - [x] Test exploration on different model types
  
  - [x] Phase 2: Event-Based Statistics Collection
    - [x] Add event listeners for model loading completion
    - [x] Implement tracking for inference start/end events
    - [x] Monitor chat completion events with usage stats flag enabled
    - [x] Create hooks for capturing statistics at key moments
  
  - [x] Phase 3: Direct Access Implementation
    - [x] Add direct access to model metadata after loading
    - [x] Implement pipeline state inspection for token stats
    - [x] Create safe accessors for internal properties
    - [x] Add fallbacks when properties aren't available
    
  - [ ] Phase 4: Session-Based Statistics
    - [x] Create session management for tracking per-conversation stats
    - [x] Implement stat aggregation across chat turns
    - [x] Add timestamp tracking for performance metrics
    - [ ] Create reset capabilities for new chat sessions

- [ ] Fix model downloads not reporting correct size
  - [x] Implement detailed progress callback logging
    - [x] Create structured logging for download events
    - [x] Track partial downloads and resumptions
    - [ ] Monitor actual bytes transferred vs reported
  - [ ] Add network request monitoring
    - [ ] Implement network inspector for download requests
    - [ ] Compare reported size with actual transferred bytes
    - [ ] Track cache usage vs new downloads
  - [ ] Create visual progress indicators
    - [x] Add detailed progress bar with percentage
    - [ ] Show download speed and estimated time
    - [ ] Indicate different download phases (metadata, weights, etc.)

## Implementation Schedule
- Week 1: Complete Phase 1 (Engine Exploration) and begin Phase 2 ✅
- Week 2: Complete Phase 2 (Event-Based Collection) and begin Phase 3 ✅
- Week 3: Complete Phase 3 (Direct Access) and download size reporting fix - IN PROGRESS
- Week 4: Implement Phase 4 (Session-Based Stats) and conduct testing

## Testing Plan (After Fixes)
- [ ] Test with various models:
  - [ ] Small model (< 1GB): Phi-2, TinyLlama
  - [ ] Medium model (1-3GB): Gemma-2B, Llama-2-7B-chat-q4
  - [ ] Large model (>3GB): Mistral-7B, Llama-2-13B
- [ ] Verify statistics accuracy:
  - [ ] Compare displayed download size with model provider specs
  - [ ] Check token count accuracy
  - [ ] Validate memory usage reporting
  - [ ] Verify context window usage calculation
  - [ ] Test speed measurements for prefill and decoding
- [ ] Test responsive behavior on different devices
  - [ ] Desktop browsers (Chrome, Firefox, Safari)
  - [ ] Mobile devices (iOS, Android)
  - [ ] Various screen sizes and orientations
- [ ] Performance impact testing
  - [ ] Measure overhead of statistics collection
  - [ ] Ensure stats gathering doesn't affect inference speed
  - [ ] Test memory usage during long chat sessions

## Future Enhancements
- Historical stats collection and visualization
  - Tracking performance across multiple sessions
  - Graph-based visualization of model performance
- Export stats as CSV/JSON
  - Detailed report generation for analysis
  - Shareable format for community benchmarks
- Compare performance between models
  - Side-by-side comparison UI
  - Normalized metrics for fair comparison
- Advanced memory usage breakdown
  - Detailed memory allocation by component
  - Peak vs average usage metrics
- Session-based statistics
  - Per-conversation analytics
  - User interaction metrics

## High Priority
- [x] Fix `no-explicit-any` TypeScript errors from build:
  - [x] `src/components/llm/ChatInterface.tsx` (lines 43, 208, 333, 334)
  - [x] `src/hooks/useModelStats.ts` (lines 174, 313)
- [x] Implement comprehensive type safety for MLCEngine extensions
- [x] Add error boundaries to chat interface components
- [ ] Create documentation for type extension patterns used

## Medium Priority
- [ ] Implement proper cleanup handlers for engine disposal
- [ ] Add performance monitoring for model inference
- [ ] Create unit tests for type assertion helpers
- [ ] Document private property access workarounds

## Completed
- [x] Fix missing Progress component from shadcn/ui library
- [x] Debug data flow from ChatInterface to main page
- [x] Add logging to track data collection
- [x] Fix model loading/download hanging issue
- [x] Handle Promise-based return from runtimeStatsText()
- [x] Fix TypeScript errors in useModelStats hook (2025-04-04)
- [x] Implement safe type assertions for MLCEngine extensions (2025-04-04)