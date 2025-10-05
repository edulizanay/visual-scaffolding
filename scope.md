# Visual Code Orchestration System - UX & Features Summary

## Core Concept
A visual tool that lets users control where and how Claude Code (and other LLM coding agents) work within their codebase, solving the problem of degradation after 6-8 files and lack of trust/comprehension as code complexity grows.

## Primary Features

### 1. Visual Domain Management
- **Visual representation** of codebase as simplified, intuitive structure (potentially tree/graph/subway map)
- **Recursive navigation** - start with high-level domains, drill down into specific areas
- **Human-friendly descriptions** for each domain/file ("User login system" not just "/auth")
- **Noise filtering** - hide irrelevant files (.env, .gitignore) unless specifically needed
- **Dynamic focus adjustment** - like a camera aperture, control how much context you're working with

### 2. Selective Scope Control
- **Click/select domains or files** to define Claude's working boundary
- **Save named working sets** ("Frontend voice feature", "Backend optimization")
- **Non-contiguous selection** - select multiple unrelated areas if needed
- **Permission levels** per selection:
  - Read-only
  - Modify existing files only
  - Create new files within folders
  - Full creative freedom

### 3. Plan Mode Visualization
- **Before coding starts**, see WHERE changes will happen on the visual map
- **Component-level change preview**:
  - Files to be created (shown as new boxes)
  - Files to be modified (color change)
  - Functions to be added/removed (shown as +/- indicators)
- **Selective approval** - approve/reject individual changes, not all-or-nothing
- **Before/after comparison** of repository structure

### 4. Progressive Context System
- **Active domain**: Full code detail, Claude can modify
- **Adjacent domains**: Show only function signatures and interfaces
- **Distant domains**: Show only high-level descriptions
- **On-demand detail** - Claude can request more info about other domains through tools
- **Automatic abstraction** - system generates simplified descriptions for non-active areas

### 5. Multi-Agent Orchestration
- **Multiple parallel sessions** with different Claude instances
- **Each agent owns a domain** with specialized expertise
- **Visual indicator** showing which agents are working where
- **Cross-domain requests** visible in UI ("Frontend agent needs Backend to add endpoint")
- **Shared interface file** that all agents can reference
- **No overlapping scopes** to prevent conflicts

### 6. Change Tracking & Validation
- **Real-time boundary enforcement** - visual confirmation that Claude stayed within scope
- **Component-level change log** showing what was added/modified/removed
- **Test status indicators** on visual elements (untested/passed/failed)
- **Risk visualization** - see which components are "critical branches" vs "safe leaves"
- **Impact analysis** - "if this breaks, 47 other things break"

### 7. Living Documentation
- **Auto-generated descriptions** that update after each accepted change
- **Multiple abstraction levels**:
  - Product Manager view: "Handles user authentication"
  - Architect view: "JWT-based auth with Redis sessions"
  - Developer view: "login(email, password) → token"
- **Domain expertise persistence** - each agent maintains understanding of its area

## User Workflow

1. **Open project** → See simplified domain overview
2. **Select working area** → Click/drag to define boundaries
3. **Request changes** → Tell Claude what to build
4. **Review plan** → See visual preview of proposed changes
5. **Approve/modify** → Accept all, reject some, or request adjustments
6. **Monitor execution** → Watch Claude work within boundaries
7. **Validate** → Check test status and impact analysis
8. **System updates** → Abstractions regenerate for future work

## Key UX Principles

- **Start simple, grow naturally** - Begin with one file, let structure emerge organically
- **Visual-first** - See changes before they happen, not after
- **Selective detail** - Only see full complexity where you're actively working
- **Trust through transparency** - Always know WHERE Claude will make changes
- **Non-technical friendly** - Natural language descriptions, no need to read code
- **Parallel work enabled** - Multiple agents can work simultaneously without conflicts

## Problem Solving

- **Prevents degradation** by keeping each agent focused on smaller scope
- **Builds trust** through visual preview and boundary enforcement
- **Manages complexity** through progressive abstraction
- **Enables scaling** - Human comprehension stays constant as codebase grows
- **Supports learning** - See what's being built step-by-step, not all at once

## Core Innovation
Instead of giving Claude entire codebases (causing degradation) or restricting to single files (too limiting), this creates **smart context windows** that include full detail where needed and progressive abstractions everywhere else, mimicking how human developers actually think about code.